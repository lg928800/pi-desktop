/**
 * 假 pi 子进程：按脚本回放 RPC 协议，用于 bridge 的单测（不烧 token）。
 * 只实现测试用到的命令与事件；真实行为以 spike/P0-RESULTS.md 的实测为准。
 */
import { Buffer } from "node:buffer";

const out = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

let buf = Buffer.alloc(0);
const uiWaiters = new Map();

process.stdin.on("data", (chunk) => {
	buf = Buffer.concat([buf, chunk]);
	for (;;) {
		const idx = buf.indexOf(0x0a);
		if (idx === -1) break;
		let line = buf.subarray(0, idx);
		buf = buf.subarray(idx + 1);
		if (line.length && line[line.length - 1] === 0x0d) line = line.subarray(0, line.length - 1);
		if (!line.length) continue;
		handle(JSON.parse(line.toString("utf8")));
	}
});

function respond(req, data) {
	out({ id: req.id, type: "response", command: req.type, success: true, data });
}

function assistant(text, chunks = [text]) {
	const message = { role: "assistant", content: [{ type: "text", text }], stopReason: "stop", timestamp: Date.now() };
	out({ type: "message_start", message: { role: "assistant", content: [], stopReason: "pending", timestamp: Date.now() } });
	for (const delta of chunks) {
		out({ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta } });
	}
	out({ type: "message_end", message });
}

function settle(aborted = false) {
	out({ type: "agent_end", messages: [], willRetry: false });
	out({ type: "agent_settled", aborted });
}

const handlers = {
	get_state(req) {
		respond(req, {
			sessionId: "fake-session",
			sessionFile: "/tmp/fake.jsonl",
			cwd: process.cwd(),
			model: { provider: "fake", id: "fake-model", input: ["text", "image"] },
			thinkingLevel: "medium",
		});
	},

	async prompt(req) {
		const message = String(req.message ?? "");
		respond(req, { disposition: "started" });

		if (message.includes("EXIT")) {
			process.exit(3);
		}
		if (message.includes("BADJSON")) {
			process.stdout.write("{not json}\n");
		}
		if (message.includes("SLOW")) {
			return; // 永不 settle，用于超时测试
		}

		out({ type: "agent_start" });
		out({
			type: "message_start",
			message: { role: "user", content: message, timestamp: Date.now() },
		});
		out({
			type: "message_end",
			message: { role: "user", content: message, timestamp: Date.now() },
		});

		if (message.includes("APPROVE_ME")) {
			const uiId = `ui-${Date.now()}`;
			const decision = await new Promise((resolve) => {
				uiWaiters.set(uiId, resolve);
				out({
					type: "extension_ui_request",
					id: uiId,
					method: "confirm",
					title: "Allow dangerous command?",
					message: "rm -rf /tmp/x",
					timeout: 60000,
				});
			});
			if (!decision) {
				out({
					type: "message_start",
					message: { role: "assistant", content: [], stopReason: "pending", timestamp: Date.now() },
				});
				out({
					type: "message_end",
					message: {
						role: "assistant",
						content: [{ type: "text", text: "blocked" }],
						stopReason: "stop",
						timestamp: Date.now(),
					},
				});
				settle();
				return;
			}
			out({ type: "tool_execution_start", toolCallId: "tc-1", toolName: "bash", args: { command: "rm -rf /tmp/x" } });
			out({
				type: "tool_execution_end",
				toolCallId: "tc-1",
				toolName: "bash",
				result: { content: [{ type: "text", text: "done" }], details: {} },
				isError: false,
			});
			assistant("approved and ran", ["approved", " and ran"]);
			settle();
			return;
		}

		assistant("hello world", ["hello", " world"]);
		settle();
	},

	abort(req) {
		respond(req, {});
		settle(true);
	},
};

function handle(rec) {
	if (rec.type === "hang") return; // 有 id 但不回，用于超时测试
	if (rec.type === "stderr") {
		process.stderr.write(`${rec.text ?? ""}\n`);
		if (rec.id) respond(rec, {});
		return;
	}
	if (rec.type === "extension_ui_response") {
		const resolve = uiWaiters.get(rec.id);
		if (resolve) {
			uiWaiters.delete(rec.id);
			resolve(Boolean(rec.confirmed));
		}
		return;
	}
	const fn = handlers[rec.type];
	if (!fn) {
		if (rec.id) {
			out({ id: rec.id, type: "response", command: rec.type, success: false, error: `unsupported: ${rec.type}` });
		}
		return;
	}
	Promise.resolve(fn(rec)).catch((error) => {
		if (rec.id) {
			out({ id: rec.id, type: "response", command: rec.type, success: false, error: String(error) });
		}
	});
}
