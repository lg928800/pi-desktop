import { describe, expect, it } from "vitest";
import type { ServerEvent } from "@pi-desktop/shared";
import { EventNormalizer } from "./normalize.ts";

function collect() {
	const events: ServerEvent[] = [];
	const normalizer = new EventNormalizer("s1", (e) => events.push(e));
	return { events, normalizer };
}

describe("EventNormalizer", () => {
	it("delta 后由 message.final 整体替换", () => {
		const { events, normalizer } = collect();
		normalizer.push({ type: "message_start", message: { role: "assistant" } });
		normalizer.push({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "he" } });
		normalizer.push({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "llo" } });
		normalizer.push({
			type: "message_end",
			message: { role: "assistant", content: [{ type: "text", text: "hello!" }] },
		});

		expect(events.filter((e) => e.type === "message.delta")).toHaveLength(2);
		const final = events.find((e) => e.type === "message.final") as { text: string; images: unknown[] };
		expect(final.text).toBe("hello!");
		expect(final.images).toHaveLength(0);
	});

	it("忽略 user 消息（UI 自己回显）", () => {
		const { events, normalizer } = collect();
		normalizer.push({ type: "message_start", message: { role: "user" } });
		normalizer.push({ type: "message_end", message: { role: "user", content: "hi" } });
		expect(events).toHaveLength(0);
	});

	it("工具开始/结束映射，输出取 text 块", () => {
		const { events, normalizer } = collect();
		normalizer.push({ type: "tool_execution_start", toolCallId: "t1", toolName: "bash", args: { command: "ls" } });
		normalizer.push({
			type: "tool_execution_end",
			toolCallId: "t1",
			toolName: "bash",
			result: { content: [{ type: "text", text: "a.txt" }] },
			isError: false,
		});
		expect(events[0]).toMatchObject({ type: "tool.start", toolName: "bash", input: { command: "ls" } });
		expect(events[1]).toMatchObject({ type: "tool.end", status: "ok", output: "a.txt" });
	});

	it("工具出错标记 error", () => {
		const { events, normalizer } = collect();
		normalizer.push({
			type: "tool_execution_end",
			toolCallId: "t1",
			toolName: "edit",
			result: { content: [] },
			isError: true,
		});
		expect(events[0]).toMatchObject({ type: "tool.end", status: "error" });
	});

	it("agent_settled 才产生 run.settled；agent_end 不产生", () => {
		const { events, normalizer } = collect();
		normalizer.push({ type: "agent_end", willRetry: false, messages: [] });
		expect(events).toHaveLength(0);
		normalizer.push({ type: "agent_settled", aborted: false });
		expect(events).toEqual([{ type: "run.settled", sessionId: "s1" }]);
	});

	it("extension_ui_request 转成 approval.request", () => {
		const { events, normalizer } = collect();
		normalizer.push({
			type: "extension_ui_request",
			id: "ui-1",
			method: "confirm",
			title: "Allow?",
			message: "rm -rf /tmp",
			timeout: 10000,
		});
		expect(events[0]).toMatchObject({
			type: "approval.request",
			request: { requestId: "ui-1", kind: "confirm", detail: "rm -rf /tmp", timeoutMs: 10000 },
		});
	});

	it("notify 等单向 UI 方法不产生审批事件", () => {
		const { events, normalizer } = collect();
		normalizer.push({ type: "extension_ui_request", id: "x", method: "notify", message: "hi" });
		expect(events).toHaveLength(0);
	});

	it("图片转成 ref 并可回取，事件里不带 base64", () => {
		const { events, normalizer } = collect();
		normalizer.push({
			type: "message_end",
			message: {
				role: "assistant",
				content: [
					{ type: "text", text: "看图" },
					{ type: "image", data: "AAAA", mimeType: "image/png" },
				],
			},
		});
		const final = events[0] as { images: Array<{ ref: string }>; text: string };
		expect(final.text).toBe("看图");
		expect(final.images[0]?.ref).toBe("img1");
		expect(JSON.stringify(events)).not.toContain("AAAA");
		expect(normalizer.getAsset("img1")).toEqual({ data: "AAAA", mimeType: "image/png" });
	});
});
