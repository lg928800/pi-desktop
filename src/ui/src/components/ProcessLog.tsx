import { useEffect, useState } from "react";
import type { TimelineItem } from "../lib/session-view.ts";
import { MarkdownView } from "./Markdown.tsx";

interface Props {
	items: TimelineItem[];
	running: boolean;
}

/**
 * 执行过程：终端风格。
 * 运行中默认展开（能看着它干活），结束后默认折叠（只留结论）。
 */
export function ProcessLog({ items, running }: Props) {
	const [open, setOpen] = useState(running);

	useEffect(() => {
		setOpen(running);
	}, [running]);

	const toolCount = items.filter((item) => item.kind === "tool").length;
	const failed = items.some((item) => item.kind === "tool" && item.status === "error");
	if (items.length === 0) return null;

	return (
		<div className={`process ${open ? "open" : ""} ${failed ? "has-error" : ""}`}>
			<button className="process-head" onClick={() => setOpen((v) => !v)}>
				<span className="process-caret">{open ? "▾" : "▸"}</span>
				<span className="process-title">执行过程</span>
				<span className="process-meta">
					{toolCount > 0 && `${toolCount} 个工具`}
					{running && " · 进行中"}
				</span>
			</button>

			{open && (
				<div className="term">
					{items.map((item) =>
						item.kind === "tool" ? (
							<div key={item.id} className={`term-cmd ${item.status}`}>
								<div className="term-line">
									<span className="term-prompt">$</span>
									<span className="term-tool">{item.toolName}</span>
									<span className="term-args">{summarize(item.input)}</span>
									<span className={`term-state ${item.status}`}>
										{item.status === "running" ? "●" : item.status === "ok" ? "✓" : item.status === "blocked" ? "⊘" : "✕"}
									</span>
								</div>
								{item.output && <pre className="term-out">{item.output.slice(-4000)}</pre>}
							</div>
						) : (
							<div key={item.id} className="term-thought">
								<MarkdownView text={item.text} />
							</div>
						),
					)}
				</div>
			)}
		</div>
	);
}

function summarize(input: unknown): string {
	const args = (input ?? {}) as Record<string, unknown>;
	if (typeof args.command === "string") return args.command.slice(0, 120);
	for (const key of ["path", "file_path", "pattern", "query"]) {
		if (typeof args[key] === "string") return `${key}=${String(args[key]).slice(0, 100)}`;
	}
	const first = Object.values(args).find((value) => typeof value === "string");
	return typeof first === "string" ? first.slice(0, 100) : "";
}
