import { useEffect, useRef } from "react";
import type { Task } from "@pi-desktop/shared";
import type { SessionView } from "../lib/session-view.ts";
import { Composer } from "./Composer.tsx";
import { MarkdownView } from "./Markdown.tsx";
import { ToolCard } from "./ToolCard.tsx";

interface Props {
	view: SessionView;
	task: Task | null;
	onSend: (text: string, images: Array<{ type: "image"; data: string; mimeType: string }>) => Promise<void>;
	onAbort: () => Promise<void>;
}

export function Chat({ view, task, onSend, onAbort }: Props) {
	const bottom = useRef<HTMLDivElement>(null);

	const lastText = view.items.at(-1);
	const streamKey = lastText?.kind === "message" ? lastText.text.length : 0;

	useEffect(() => {
		bottom.current?.scrollIntoView({ block: "end" });
	}, [view.items.length, streamKey]);

	return (
		<section className="chat">
			<div className="pane-head center-head">
				<span className="pane-title">{task ? task.title : "对话"}</span>
				{view.sessionId && <span className="chip mono">{shortId(view.sessionId)}</span>}
				{task?.branch && <span className="chip">⎇ {task.branch}</span>}
				<span className="spacer" />
				{view.status === "running" && <span className="typing">AI 正在输出…</span>}
			</div>

			<div className="pane-scroll timeline">
				{view.items.length === 0 && (
					<div className="empty">
						<div className="empty-mark">⌘</div>
						<p>{task ? "会话已就绪，说点什么" : "在左侧选一个任务开始"}</p>
						<p className="dim">支持粘贴图片 · Enter 发送 · Shift+Enter 换行</p>
					</div>
				)}

				{view.items.map((item) =>
					item.kind === "tool" ? (
						<ToolCard key={item.id} item={item} />
					) : (
						<article key={item.id} className={`msg ${item.role}`}>
							<div className="msg-head">
								<span className="avatar">{item.role === "user" ? "你" : "AI"}</span>
							</div>
							<div className="msg-body">
								{item.role === "assistant" ? <MarkdownView text={item.text} /> : <span className="plain">{item.text}</span>}
								{item.streaming && <span className="cursor">▌</span>}
							</div>
							{item.images.length > 0 && (
								<div className="msg-images">
									{item.images.map((image) => (
										<span key={image.ref} className="chip">
											🖼 {image.mimeType}
										</span>
									))}
								</div>
							)}
						</article>
					),
				)}
				<div ref={bottom} />
			</div>

			<Composer disabled={!view.sessionId} running={view.status === "running"} onSend={onSend} onAbort={onAbort} />
		</section>
	);
}

function shortId(id: string): string {
	const parts = id.split("_");
	return parts.at(-1)?.slice(0, 6) ?? id.slice(0, 6);
}
