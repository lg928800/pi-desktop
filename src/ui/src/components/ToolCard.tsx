import { useState } from "react";
import type { TimelineItem } from "../lib/session-view.ts";

const HIDDEN_ON_COLLAPSE: Record<string, string> = {
	read: "文件",
	bash: "命令",
	edit: "改动",
	write: "写入",
	grep: "检索",
	find: "查找",
	ls: "列表",
};

export function ToolCard({ item }: { item: Extract<TimelineItem, { kind: "tool" }> }) {
	const [open, setOpen] = useState(item.status === "error");
	const summary = summarize(item.toolName, item.input);

	return (
		<article className={`tool ${item.status}`}>
			<button className="tool-head" onClick={() => setOpen((v) => !v)}>
				<span className="tool-name">{HIDDEN_ON_COLLAPSE[item.toolName] ?? item.toolName}</span>
				<span className="tool-summary">{summary}</span>
				<span className={`tool-status ${item.status}`}>
					{item.status === "running" ? "运行中" : item.status === "ok" ? "完成" : item.status === "blocked" ? "已拦截" : "失败"}
				</span>
			</button>
			{open && (
				<div className="tool-body">
					<pre className="tool-args">{JSON.stringify(item.input, null, 2)}</pre>
					{item.output && <pre className="tool-output">{item.output.slice(0, 8000)}</pre>}
				</div>
			)}
		</article>
	);
}

function summarize(toolName: string, input: unknown): string {
	const args = (input ?? {}) as Record<string, unknown>;
	if (toolName === "bash" && typeof args.command === "string") return args.command.slice(0, 90);
	for (const key of ["path", "file_path", "pattern", "query"]) {
		if (typeof args[key] === "string") return String(args[key]).slice(0, 90);
	}
	const first = Object.values(args).find((value) => typeof value === "string");
	return typeof first === "string" ? first.slice(0, 90) : "";
}
