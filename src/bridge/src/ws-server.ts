/**
 * WS 传输层（design.md §3）。
 *
 * 安全底线（AGENTS.md 红线）：
 *  - 只绑 127.0.0.1，不监听外网。
 *  - 必须带一次性 token；不带或不对直接 1008 关闭，不返回任何数据。
 *  - 校验 Origin：只允许本机来源与 Tauri 的 origin，其余拒绝。
 */
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientResponse, ServerEvent } from "@pi-desktop/shared";

export interface WsServerOptions {
	token: string;
	port?: number;
	host?: string;
	/** 处理一条请求；抛错即返回 ok:false */
	onOp: (request: { id: string; op: string } & Record<string, unknown>) => Promise<unknown>;
}

export interface RunningWsServer {
	port: number;
	broadcast: (event: ServerEvent) => void;
	close: () => Promise<void>;
	clientCount: () => number;
}

const ALLOWED_ORIGINS = [/^tauri:\/\//, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^https?:\/\/tauri\.localhost$/];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export async function startWsServer(options: WsServerOptions): Promise<RunningWsServer> {
	const host = options.host ?? "127.0.0.1";
	if (host !== "127.0.0.1") throw new Error(`refusing to bind non-loopback host: ${host}`);

	const wss = new WebSocketServer({ host, port: options.port ?? 0 });

	await new Promise<void>((resolve, reject) => {
		wss.once("listening", () => resolve());
		wss.once("error", reject);
	});

	wss.on("connection", (socket: WebSocket, request) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1");
		const origin = request.headers.origin;

		if (origin && !ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
			socket.close(1008, "origin not allowed");
			return;
		}
		if (url.searchParams.get("token") !== options.token) {
			socket.close(1008, "invalid token");
			return;
		}

		socket.on("message", (data) => {
			void handleMessage(socket, data.toString());
		});
	});

	async function handleMessage(socket: WebSocket, raw: string) {
		let request: { id?: unknown; op?: unknown } & Record<string, unknown>;
		try {
			request = JSON.parse(raw) as typeof request;
		} catch {
			send(socket, { id: "", ok: false, error: "invalid JSON" });
			return;
		}

		const id = typeof request.id === "string" ? request.id : "";
		const op = typeof request.op === "string" ? request.op : "";
		if (!id || !op) {
			send(socket, { id, ok: false, error: "missing id or op" });
			return;
		}

		try {
			const data = await options.onOp(request as { id: string; op: string });
			send(socket, { id, ok: true, data });
		} catch (error) {
			send(socket, { id, ok: false, error: error instanceof Error ? error.message : String(error) });
		}
	}

	function send(socket: WebSocket, response: ClientResponse) {
		if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(response));
	}

	const address = wss.address();
	const port = typeof address === "object" && address ? address.port : 0;

	return {
		port,
		broadcast(event: ServerEvent) {
			const payload = JSON.stringify(event);
			for (const client of wss.clients) {
				if (client.readyState === client.OPEN) client.send(payload);
			}
		},
		clientCount: () => wss.clients.size,
		close: () =>
			new Promise<void>((resolve) => {
				for (const client of wss.clients) client.terminate();
				wss.close(() => resolve());
			}),
	};
}

export function isLoopbackHost(host: string): boolean {
	return LOCAL_HOSTS.has(host);
}
