/**
 * 把 pi 的原始 JSONL 记录翻译成 UI 用的 ServerEvent（design.md §3）。
 *
 * 不变式：
 *  - message.delta 只用于即时显示；message.final 到达后必须整体替换。
 *  - 结束只认 agent_settled（不是 agent_end）。
 *  - 图片不进事件，只传 ImageRef，像素另走资产表。
 */
import type { ImageRef, ServerEvent } from "@pi-desktop/shared";
import type { JsonRecord } from "./frame-splitter.ts";

export interface Asset {
	data: string;
	mimeType: string;
}

const ASSET_LIMIT = 32;

export class EventNormalizer {
	private assistantSeq = 0;
	private currentAssistantId: string | null = null;
	private assetSeq = 0;
	private readonly assets = new Map<string, Asset>();

	constructor(
		private readonly sessionId: string,
		private readonly emit: (event: ServerEvent) => void,
	) {}

	getAsset(ref: string): Asset | undefined {
		return this.assets.get(ref);
	}

	push(record: JsonRecord): void {
		switch (record.type) {
			case "message_start": {
				const message = record.message as { role?: string } | undefined;
				if (message?.role === "assistant") {
					this.currentAssistantId = `m${++this.assistantSeq}`;
				}
				return;
			}
			case "message_update": {
				const update = record.assistantMessageEvent as { type?: string; delta?: string } | undefined;
				if (update?.type !== "text_delta" || typeof update.delta !== "string") return;
				if (!this.currentAssistantId) return;
				this.emit({
					type: "message.delta",
					sessionId: this.sessionId,
					messageId: this.currentAssistantId,
					text: update.delta,
				});
				return;
			}
			case "message_end": {
				const message = record.message as
					| { role?: string; content?: unknown; stopReason?: string }
					| undefined;
				if (message?.role !== "assistant") return;
				const messageId = this.currentAssistantId ?? `m${++this.assistantSeq}`;
				this.currentAssistantId = null;

				const blocks = Array.isArray(message.content) ? message.content : [];
				let text = "";
				const images: ImageRef[] = [];
				for (const block of blocks as Array<Record<string, unknown>>) {
					if (block.type === "text" && typeof block.text === "string") text += block.text;
					if (block.type === "image" && typeof block.data === "string") {
						images.push(this.rememberImage(block.data, String(block.mimeType ?? "image/png")));
					}
				}
				this.emit({ type: "message.final", sessionId: this.sessionId, messageId, text, images });
				return;
			}
			case "tool_execution_start": {
				this.emit({
					type: "tool.start",
					sessionId: this.sessionId,
					toolCallId: String(record.toolCallId ?? ""),
					toolName: String(record.toolName ?? ""),
					input: record.args,
				});
				return;
			}
			case "tool_execution_end": {
				this.emit({
					type: "tool.end",
					sessionId: this.sessionId,
					toolCallId: String(record.toolCallId ?? ""),
					status: record.isError ? "error" : "ok",
					output: extractText(record.result),
				});
				return;
			}
			case "agent_settled": {
				this.currentAssistantId = null;
				this.emit({ type: "run.settled", sessionId: this.sessionId });
				return;
			}
			case "extension_ui_request": {
				const method = String(record.method ?? "");
				if (method !== "confirm" && method !== "select" && method !== "input" && method !== "editor") return;
				this.emit({
					type: "approval.request",
					request: {
						requestId: String(record.id ?? ""),
						sessionId: this.sessionId,
						kind: method,
						title: String(record.title ?? ""),
						detail: typeof record.message === "string" ? record.message : undefined,
						options: Array.isArray(record.options) ? record.options.map(String) : undefined,
						timeoutMs: typeof record.timeout === "number" ? record.timeout : undefined,
					},
				});
				return;
			}
			default:
				return;
		}
	}

	private rememberImage(data: string, mimeType: string): ImageRef {
		const ref = `img${++this.assetSeq}`;
		this.assets.set(ref, { data, mimeType });
		while (this.assets.size > ASSET_LIMIT) {
			const oldest = this.assets.keys().next().value;
			if (oldest === undefined) break;
			this.assets.delete(oldest);
		}
		return { type: "image", ref, mimeType };
	}
}

function extractText(result: unknown): string {
	const content = (result as { content?: unknown })?.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((block) => (block as { type?: string; text?: string }))
		.filter((block) => block?.type === "text" && typeof block.text === "string")
		.map((block) => block.text as string)
		.join("");
}
