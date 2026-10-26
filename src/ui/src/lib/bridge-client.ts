/**
 * WS 客户端：连接 bridge、发 op、收事件。
 * token 来源：URL 参数 ?token= → localStorage → 由 Tauri 注入的 window.__PI_DESKTOP__。
 */
import type { ClientOp, ServerEvent } from "@pi-desktop/shared";

export type EventHandler = (event: ServerEvent) => void;

export interface BridgeEndpoint {
	url: string;
	token: string;
}

declare global {
	interface Window {
		__PI_DESKTOP__?: { url?: string; token?: string };
	}
}

export function resolveEndpoint(): BridgeEndpoint | null {
	const params = new URLSearchParams(window.location.search);
	const injected = window.__PI_DESKTOP__;
	const token = params.get("token") ?? localStorage.getItem("pi-desktop.token") ?? injected?.token ?? "";
	const url = params.get("bridge") ?? localStorage.getItem("pi-desktop.url") ?? injected?.url ?? "";
	if (!token) return null;
	const base = url || "ws://127.0.0.1:8787/";
	return { url: base, token };
}

export function rememberEndpoint(endpoint: BridgeEndpoint): void {
	localStorage.setItem("pi-desktop.token", endpoint.token);
	localStorage.setItem("pi-desktop.url", endpoint.url);
}

export class BridgeClient {
	private socket?: WebSocket;
	private readonly pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
	private readonly handlers = new Set<EventHandler>();
	private seq = 0;
	onStatus?: (status: "connecting" | "open" | "closed") => void;

	constructor(private readonly endpoint: BridgeEndpoint) {}

	connect(): void {
		const sep = this.endpoint.url.includes("?") ? "&" : "?";
		const socket = new WebSocket(`${this.endpoint.url}${sep}token=${encodeURIComponent(this.endpoint.token)}`);
		this.socket = socket;
		this.onStatus?.("connecting");

		socket.onopen = () => this.onStatus?.("open");
		socket.onclose = () => {
			this.onStatus?.("closed");
			for (const [, entry] of this.pending) entry.reject(new Error("connection closed"));
			this.pending.clear();
		};
		socket.onmessage = (message) => {
			const record = JSON.parse(String(message.data)) as Record<string, unknown>;
			if (typeof record.id === "string" && (record.ok === true || record.ok === false)) {
				const entry = this.pending.get(record.id);
				if (!entry) return;
				this.pending.delete(record.id);
				if (record.ok) entry.resolve(record.data);
				else entry.reject(new Error(String(record.error ?? "op failed")));
				return;
			}
			for (const handler of this.handlers) handler(record as unknown as ServerEvent);
		};
	}

	onEvent(handler: EventHandler): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	call<T = unknown>(op: Omit<ClientOp, "id">): Promise<T> {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error("bridge 未连接"));
		}
		const id = `ui${++this.seq}`;
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
			this.socket!.send(JSON.stringify({ id, ...op }));
		});
	}

	close(): void {
		this.socket?.close();
	}
}
