/**
 * 端到端冒烟：起 bridge → WS 建项目/功能集/任务 → 开会话（真实 pi）→ 发一句话 → 等 settled。
 *
 * 会真实调用模型（约一次极短对话）。用于验证 T11，不进单测。
 * 用法：node scripts/e2e-smoke.mjs [项目根目录]
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const root = process.argv[2] ?? process.cwd();
const stateDir = mkdtempSync(join(tmpdir(), "pidesk-e2e-"));
const timeoutMs = 180_000;

const bridge = spawn(process.execPath, ["--import", "tsx", "src/bridge/src/main.ts"], {
	cwd: process.cwd(),
	env: { ...process.env, PI_DESKTOP_PORT: "0", PI_DESKTOP_STATE: join(stateDir, "state.json") },
	stdio: ["ignore", "pipe", "inherit"],
});

const ready = await new Promise((resolve, reject) => {
	const timer = setTimeout(() => reject(new Error("bridge did not start in 20s")), 20_000);
	let buf = "";
	bridge.stdout.on("data", (chunk) => {
		buf += chunk.toString();
		const line = buf.split("\n")[0];
		if (!line) return;
		try {
			const value = JSON.parse(line);
			if (value.type === "bridge.ready") {
				clearTimeout(timer);
				resolve(value);
			}
		} catch {
			/* 半行，继续等 */
		}
	});
});

const socket = new WebSocket(ready.url);
await new Promise((resolve, reject) => {
	socket.once("open", resolve);
	socket.once("error", reject);
});

let seq = 0;
const pending = new Map();
const seen = [];
const settled = new Set();
let settledResolve;
const settledPromise = new Promise((r) => (settledResolve = r));

socket.on("message", (raw) => {
	const record = JSON.parse(String(raw));
	if (record.id && (record.ok === true || record.ok === false)) {
		const entry = pending.get(record.id);
		if (!entry) return;
		pending.delete(record.id);
		record.ok ? entry.resolve(record.data) : entry.reject(new Error(record.error));
		return;
	}
	seen.push(record);
	if (record.type === "run.settled") settledResolve();
});

const call = (op, extra = {}) =>
	new Promise((resolve, reject) => {
		const id = `e2e${++seq}`;
		pending.set(id, { resolve, reject });
		socket.send(JSON.stringify({ id, op, ...extra }));
	});

try {
	const project = await call("project.create", { name: "e2e", root });
	const feature = await call("feature.create", { projectId: project.id, name: "冒烟" });
	const task = await call("task.create", { featureId: feature.id, title: "跑一句话" });
	const started = await call("session.start", { taskId: task.id });
	console.log(`会话 ${started.sessionId} 已启动，可用模型 ${started.models.length} 个`);

	await call("prompt.send", { sessionId: started.sessionId, message: "只回复两个字：收到。不要使用任何工具。" });
	await Promise.race([settledPromise, new Promise((_, rej) => setTimeout(() => rej(new Error("等待 agent_settled 超时")), timeoutMs))]);

	const deltas = seen.filter((e) => e.type === "message.delta").map((e) => e.text);
	const final = seen.filter((e) => e.type === "message.final").at(-1);
	const tools = seen.filter((e) => e.type === "tool.start").map((e) => e.toolName);
	console.log("流式拼接:", JSON.stringify(deltas.join("")));
	console.log("权威消息:", JSON.stringify(final?.text ?? ""));
	console.log("工具调用:", tools.length ? tools.join(",") : "无");
	console.log(final?.text ? "E2E PASS" : "E2E FAIL: 没有拿到最终消息");
	process.exitCode = final?.text ? 0 : 1;
} finally {
	socket.close();
	bridge.kill("SIGTERM");
}
