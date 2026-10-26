import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { ClientOp, ServerEvent } from "@pi-desktop/shared";
import { Bridge } from "./bridge.ts";
import { RpcSession } from "./rpc-session.ts";
import { SessionManager } from "./session-manager.ts";
import { StateStore } from "./state-store.ts";

const fakePi = join(fileURLToPath(new URL(".", import.meta.url)), "__fixtures__", "fake-pi.mjs");

async function setup() {
	const dir = await mkdtemp(join(tmpdir(), "pidesk-bridge-"));
	const state = new StateStore(join(dir, "state.json"));
	const events: ServerEvent[] = [];
	let seq = 0;
	const sessions = new SessionManager(
		(e) => events.push(e),
		(init) => new RpcSession({ ...init, command: process.execPath, args: [fakePi] }),
	);
	const bridge = new Bridge({
		state,
		sessions,
		emit: (e) => events.push(e),
		newId: (prefix) => `${prefix}_${++seq}`,
	});
	const root = join(dir, "project");
	await mkdir(root, { recursive: true });
	return { bridge, sessions, events, dir, root };
}

const call = <T = unknown>(bridge: Bridge, op: ClientOp) => bridge.handle(op) as Promise<T>;

const waitFor = async (predicate: () => boolean, timeoutMs = 5000) => {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
		await new Promise((r) => setTimeout(r, 10));
	}
};

const managers: SessionManager[] = [];
afterEach(async () => {
	await Promise.all(managers.splice(0).map((m) => m.stopAll()));
});

describe("Bridge", () => {
	it("project/feature/task 创建并出现在树里", async () => {
		const { bridge, root } = await setup();
		const project = await call<{ id: string }>(bridge, {
			id: "1",
			op: "project.create",
			name: "demo",
			root,
		});
		const feature = await call<{ id: string }>(bridge, {
			id: "2",
			op: "feature.create",
			projectId: project.id,
			name: "登录",
		});
		await call(bridge, { id: "3", op: "task.create", featureId: feature.id, title: "拆服务" });

		const tree = await call<{ projects: Array<{ features: Array<{ tasks: unknown[] }> }> }>(bridge, {
			id: "4",
			op: "tree.get",
			projectId: project.id,
		});
		expect(tree.projects).toHaveLength(1);
		expect(tree.projects[0]?.features[0]?.tasks).toHaveLength(1);
	});

	it("task 必须挂在存在的 feature 下", async () => {
		const { bridge, root } = await setup();
		await expect(call(bridge, { id: "1", op: "task.create", featureId: "nope", title: "x" })).rejects.toThrow(
			/no such feature/,
		);
	});

	it("session.start 起子进程并返回模型清单，prompt 推进到 settled", async () => {
		const { bridge, sessions, events, root } = await setup();
		managers.push(sessions);

		const project = await call<{ id: string }>(bridge, {
			id: "1",
			op: "project.create",
			name: "demo",
			root,
		});
		const feature = await call<{ id: string }>(bridge, {
			id: "2",
			op: "feature.create",
			projectId: project.id,
			name: "f",
		});
		const task = await call<{ id: string }>(bridge, {
			id: "3",
			op: "task.create",
			featureId: feature.id,
			title: "t",
		});

		const started = await call<{ sessionId: string; models: Array<{ input: string[] }> }>(bridge, {
			id: "4",
			op: "session.start",
			taskId: task.id,
		});
		expect(started.sessionId).toBeTruthy();
		await waitFor(() => events.some((e) => e.type === "session.status" && e.status === "idle"));

		await call(bridge, { id: "5", op: "prompt.send", sessionId: started.sessionId, message: "hi" });
		await waitFor(() => events.some((e) => e.type === "run.settled"));

		const deltas = events.filter((e) => e.type === "message.delta") as Array<{ text: string }>;
		expect(deltas.map((d) => d.text).join("")).toBe("hello world");
		const final = events.find((e) => e.type === "message.final") as { text: string };
		expect(final.text).toBe("hello world");
	});

	it("审批请求可从 bridge 侧应答", async () => {
		const { bridge, sessions, events, root } = await setup();
		managers.push(sessions);

		const project = await call<{ id: string }>(bridge, {
			id: "1",
			op: "project.create",
			name: "d",
			root,
		});
		const feature = await call<{ id: string }>(bridge, { id: "2", op: "feature.create", projectId: project.id, name: "f" });
		const task = await call<{ id: string }>(bridge, { id: "3", op: "task.create", featureId: feature.id, title: "t" });
		const { sessionId } = await call<{ sessionId: string }>(bridge, { id: "4", op: "session.start", taskId: task.id });

		await call(bridge, { id: "5", op: "prompt.send", sessionId, message: "APPROVE_ME" });
		await waitFor(() => events.some((e) => e.type === "approval.request"));

		const request = (events.find((e) => e.type === "approval.request") as { request: { requestId: string } }).request;
		await call(bridge, { id: "6", op: "approval.reply", requestId: request.requestId, confirmed: true });

		await waitFor(() => events.some((e) => e.type === "run.settled"));
		expect(events.some((e) => e.type === "tool.end")).toBe(true);
	});

	it("拒绝审批时命令不执行", async () => {
		const { bridge, sessions, events, root } = await setup();
		managers.push(sessions);

		const project = await call<{ id: string }>(bridge, { id: "1", op: "project.create", name: "d", root });
		const feature = await call<{ id: string }>(bridge, { id: "2", op: "feature.create", projectId: project.id, name: "f" });
		const task = await call<{ id: string }>(bridge, { id: "3", op: "task.create", featureId: feature.id, title: "t" });
		const { sessionId } = await call<{ sessionId: string }>(bridge, { id: "4", op: "session.start", taskId: task.id });

		await call(bridge, { id: "5", op: "prompt.send", sessionId, message: "APPROVE_ME" });
		await waitFor(() => events.some((e) => e.type === "approval.request"));
		const request = (events.find((e) => e.type === "approval.request") as { request: { requestId: string } }).request;
		await call(bridge, { id: "6", op: "approval.reply", requestId: request.requestId, confirmed: false });

		await waitFor(() => events.some((e) => e.type === "run.settled"));
		expect(events.some((e) => e.type === "tool.end")).toBe(false);
		const final = events.filter((e) => e.type === "message.final").at(-1) as { text: string };
		expect(final.text).toBe("blocked");
	});

	it("未知 op 返回明确错误", async () => {
		const { bridge } = await setup();
		await expect(call(bridge, { id: "1", op: "nope" } as unknown as ClientOp)).rejects.toThrow(/unknown op/);
	});
});
