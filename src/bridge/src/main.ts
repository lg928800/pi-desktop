/**
 * bridge 入口：进程内组装 StateStore + SessionManager + Bridge + WS。
 * 启动后打印带 token 的地址；token 只在本机终端出现，前端从启动参数/环境读取。
 */
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClientOp, ServerEvent } from "@pi-desktop/shared";
import { Bridge } from "./bridge.ts";
import { SessionManager } from "./session-manager.ts";
import { StateStore } from "./state-store.ts";
import { startWsServer } from "./ws-server.ts";

const statePath = process.env.PI_DESKTOP_STATE ?? join(homedir(), ".pi-desktop", "state.json");
const token = process.env.PI_DESKTOP_TOKEN ?? randomBytes(24).toString("base64url");
const requestedPort = Number(process.env.PI_DESKTOP_PORT ?? 0);

const state = new StateStore(statePath);
let broadcast: (event: ServerEvent) => void = () => {};

const sessions = new SessionManager((event) => broadcast(event));
const bridge = new Bridge({
	state,
	sessions,
	emit: (event) => broadcast(event),
	newId: (prefix) => `${prefix}_${randomBytes(6).toString("hex")}`,
});

const server = await startWsServer({
	token,
	port: requestedPort,
	onOp: (request) => bridge.handle(request as unknown as ClientOp),
});
broadcast = server.broadcast;

await state.load();
if (state.lastIssue && state.lastIssue.kind !== "not-found") {
	process.stderr.write(`[bridge] state issue: ${state.lastIssue.kind} ${state.lastIssue.detail ?? ""}\n`);
}

process.stdout.write(
	`${JSON.stringify({ type: "bridge.ready", port: server.port, token, statePath, url: `ws://127.0.0.1:${server.port}/?token=${token}` })}\n`,
);

const shutdown = async () => {
	await sessions.stopAll();
	await server.close();
	process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
