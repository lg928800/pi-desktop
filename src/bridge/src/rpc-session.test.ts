import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RpcSession } from "./rpc-session.ts";
import type { JsonRecord } from "./frame-splitter.ts";

const fakePi = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__", "fake-pi.mjs");

const alive: RpcSession[] = [];

function makeSession(timeoutMs = 5000) {
	const records: JsonRecord[] = [];
	const session = new RpcSession({
		cwd: process.cwd(),
		command: process.execPath,
		args: [fakePi],
		commandTimeoutMs: timeoutMs,
		onRecord: (r) => records.push(r),
	});
	alive.push(session);
	session.start();
	return { session, records };
}

const waitFor = async (predicate: () => boolean, timeoutMs = 3000) => {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
		await new Promise((r) => setTimeout(r, 10));
	}
};

afterEach(async () => {
	await Promise.all(alive.splice(0).map((s) => s.stop(500).catch(() => {})));
});

describe("RpcSession", () => {
	it("prompt 后能收到流式 delta 与 agent_settled", async () => {
		const { session, records } = makeSession();
		await session.request("prompt", { message: "hi" });
		await waitFor(() => records.some((r) => r.type === "agent_settled"));

		const deltas = records
			.filter((r) => r.type === "message_update")
			.map((r) => (r.assistantMessageEvent as { delta: string }).delta);
		expect(deltas.join("")).toBe("hello world");
		expect(records.filter((r) => r.type === "agent_settled")).toHaveLength(1);
	});

	it("并发命令按 id 关联，不串号", async () => {
		const { session } = makeSession();
		const [a, b] = await Promise.all([session.request("get_state"), session.request("get_state")]);
		expect((a as { sessionId: string }).sessionId).toBe("fake-session");
		expect((b as { sessionId: string }).sessionId).toBe("fake-session");
	});

	it("命令失败返回拒绝", async () => {
		const { session } = makeSession();
		await expect(session.request("no_such_command")).rejects.toThrow(/unsupported/);
	});

	it("命令超时会拒绝并清理 pending", async () => {
		const { session } = makeSession(150);
		await expect(session.request("hang", {}, 150)).rejects.toThrow(/timeout/);
	});

	it("子进程非零退出，状态置为 crashed，pending 全部拒绝", async () => {
		const { session } = makeSession();
		const pending = session.request("hang", {}, 5000);
		await session.request("prompt", { message: "EXIT" });
		await expect(pending).rejects.toThrow(/exited|not available/);
		await waitFor(() => session.status === "crashed");
	});

	it("stderr 累积到尾部缓冲", async () => {
		const { session } = makeSession();
		await session.request("stderr", { text: "boom-detail" });
		await waitFor(() => session.stderrTail.includes("boom-detail"));
		expect(session.stderrTail).toContain("boom-detail");
	});

	it("notify 发出 extension_ui_response 后 fake 继续执行", async () => {
		const { session, records } = makeSession();
		await session.request("prompt", { message: "APPROVE_ME" });
		await waitFor(() => records.some((r) => r.type === "extension_ui_request"));
		const request = records.find((r) => r.type === "extension_ui_request") as { id: string };
		session.notify({ type: "extension_ui_response", id: request.id, confirmed: true });
		await waitFor(() => records.some((r) => r.type === "agent_settled"));
		expect(records.some((r) => r.type === "tool_execution_end")).toBe(true);
	});
});
