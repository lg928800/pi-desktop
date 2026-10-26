import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { startWsServer, type RunningWsServer } from "./ws-server.ts";

const servers: RunningWsServer[] = [];
const sockets: WebSocket[] = [];

async function boot(onOp: (req: Record<string, unknown>) => Promise<unknown> = async () => ({ ok: 1 })) {
	const server = await startWsServer({ token: "secret-token", onOp: onOp as never });
	servers.push(server);
	return server;
}

function connect(port: number, url: string, headers: Record<string, string> = {}) {
	const socket = new WebSocket(`ws://127.0.0.1:${port}${url}`, { headers });
	sockets.push(socket);
	return socket;
}

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		socket.once("message", (data) => resolve(JSON.parse(data.toString())));
		socket.once("error", reject);
	});
}

const closed = (socket: WebSocket) =>
	new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));

afterEach(async () => {
	for (const socket of sockets.splice(0)) socket.terminate();
	await Promise.all(servers.splice(0).map((s) => s.close()));
});

describe("startWsServer", () => {
	it("只监听回环地址", async () => {
		const server = await boot();
		expect(server.port).toBeGreaterThan(0);
		await expect(startWsServer({ token: "t", host: "0.0.0.0", onOp: async () => ({}) })).rejects.toThrow(/loopback/);
	});

	it("无 token 连接被 1008 关闭", async () => {
		const server = await boot();
		const socket = connect(server.port, "/");
		expect(await closed(socket)).toBe(1008);
	});

	it("错误 token 被 1008 关闭", async () => {
		const server = await boot();
		const socket = connect(server.port, "/?token=wrong");
		expect(await closed(socket)).toBe(1008);
	});

	it("非本机 Origin 被拒绝", async () => {
		const server = await boot();
		const socket = connect(server.port, "/?token=secret-token", { Origin: "https://evil.example.com" });
		expect(await closed(socket)).toBe(1008);
	});

	it("合法连接可以发 op 并收到应答", async () => {
		const server = await boot(async (req) => ({ echoed: req.op }));
		const socket = connect(server.port, "/?token=secret-token");
		await new Promise((resolve) => socket.once("open", resolve));

		const waiting = nextMessage(socket);
		socket.send(JSON.stringify({ id: "r1", op: "project.list" }));
		expect(await waiting).toEqual({ id: "r1", ok: true, data: { echoed: "project.list" } });
	});

	it("op 抛错时返回 ok:false 而不是断开", async () => {
		const server = await boot(async () => {
			throw new Error("boom");
		});
		const socket = connect(server.port, "/?token=secret-token");
		await new Promise((resolve) => socket.once("open", resolve));

		const waiting = nextMessage(socket);
		socket.send(JSON.stringify({ id: "r2", op: "whatever" }));
		expect(await waiting).toEqual({ id: "r2", ok: false, error: "boom" });
	});

	it("坏 JSON 返回结构化错误", async () => {
		const server = await boot();
		const socket = connect(server.port, "/?token=secret-token");
		await new Promise((resolve) => socket.once("open", resolve));

		const waiting = nextMessage(socket);
		socket.send("{not json");
		expect(await waiting).toMatchObject({ ok: false, error: "invalid JSON" });
	});

	it("broadcast 推送给所有客户端", async () => {
		const server = await boot();
		const a = connect(server.port, "/?token=secret-token");
		const b = connect(server.port, "/?token=secret-token");
		await Promise.all([
			new Promise((r) => a.once("open", r)),
			new Promise((r) => b.once("open", r)),
		]);

		const waitingA = nextMessage(a);
		const waitingB = nextMessage(b);
		server.broadcast({ type: "run.settled", sessionId: "s1" });
		expect(await waitingA).toEqual({ type: "run.settled", sessionId: "s1" });
		expect(await waitingB).toEqual({ type: "run.settled", sessionId: "s1" });
		expect(server.clientCount()).toBe(2);
	});
});
