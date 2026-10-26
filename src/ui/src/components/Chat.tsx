import { useEffect, useRef } from "react";
import type { Task } from "@pi-desktop/shared";
import type { SessionView, TimelineItem } from "../lib/session-view.ts";
import { Composer } from "./Composer.tsx";
import { MarkdownView } from "./Markdown.tsx";
import { ProcessLog } from "./ProcessLog.tsx";

interface Props {
	view: SessionView;
	task: Task | null;
	onSend: (text: string, images: Array<{ type: "image"; data: string; mimeType: string }>) => Promise<void>;
	onAbort: () => Promise<void>;
}

type RenderItem =
	| { kind: "user"; id: string; text: string }
	| { kind: "process"; id: string; items: TimelineItem[] }
	| { kind: "result"; id: string; item: Extract<TimelineItem, { kind: "message" }> };

/**
 * 把时间线切成 [用户输入] → [执行过程] → [结果]。
 * 最后一条助手消息是"结果"，中间夹在工具调用之间的助手文本算"过程"。
 */
function group(items: TimelineItem[]): RenderItem[] {
	const out: RenderItem[] = [];
	let buffer: TimelineItem[] = [];

	const flush = () => {
		if (buffer.length === 0) return;
		const last = buffer.at(-1);
		if (last && last.kind === "message") {
			if (buffer.length > 1) out.push({ kind: "process", id: `p${last.id}`, items: buffer.slice(0, -1) });
			out.push({ kind: "result", id: last.id, item: last });
		} else {
			out.push({ kind: "process", id: `p${last?.id ?? Math.random()}`, items: buffer });
		}
		buffer = [];
	};

	for (const item of items) {
		if (item.kind === "message" && item.role === "user") {
			flush();
			out.push({ kind: "user", id: item.id, text: item.text });
			continue;
		}
		buffer.push(item);
	}
	flush();
	return out;
}

export function Chat({ view, task, onSend, onAbort }: Props) {
	const bottom = useRef<HTMLDivElement>(null);
	const running = view.status === "running";
	const lastText = view.items.at(-1);
	const streamKey = lastText?.kind === "message" ? lastText.text.length : 0;

	useEffect(() => {
		bottom.current?.scrollIntoView({ block: "end" });
	}, [view.items.length, streamKey]);

	const blocks = group(view.items);

	return (
		<section className="chat">
			<div className="pane-head center-head">
				<span className="pane-title">{task ? task.title : "对话"}</span>
				{view.sessionId && <span className="chip mono">{shortId(view.sessionId)}</span>}
				{task?.branch && <span className="chip">⎇ {task.branch}</span>}
				<span className="spacer" />
				{running && <span className="typing">AI 正在输出…</span>}
			</div>

			<div className="pane-scroll timeline">
				{view.items.length === 0 && (
					<div className="empty">
						<div className="empty-mark">⌘</div>
						<p>{task ? "会话已就绪，说点什么" : "在左侧选一个任务开始"}</p>
						<p className="dim">支持粘贴图片 · Enter 发送 · Shift+Enter 换行</p>
					</div>
				)}

				{blocks.map((block) => {
					if (block.kind === "user") {
						return (
							<article key={block.id} className="msg user">
								<div className="msg-head">
									<span className="avatar">你</span>
								</div>
								<div className="msg-body">
									<span className="plain">{block.text}</span>
								</div>
							</article>
						);
					}
					if (block.kind === "process") {
						return <ProcessLog key={block.id} items={block.items} running={running} />;
					}
					return (
						<article key={block.id} className="msg assistant">
							<div className="msg-head">
								<span className="avatar">AI</span>
							</div>
							<div className="msg-body result">
								<div className="result-label">结果</div>
								<MarkdownView text={block.item.text} />
								{block.item.streaming && <span className="cursor">▌</span>}
								{block.item.images.length > 0 && (
									<div className="msg-images">
										{block.item.images.map((image) => (
											<span key={image.ref} className="chip">
												🖼 {image.mimeType}
											</span>
										))}
									</div>
								)}
							</div>
						</article>
					);
				})}
				<div ref={bottom} />
			</div>

			<Composer disabled={!view.sessionId} running={running} onSend={onSend} onAbort={onAbort} />
		</section>
	);
}

function shortId(id: string): string {
	const parts = id.split("_");
	return parts.at(-1)?.slice(0, 6) ?? id.slice(0, 6);
}
