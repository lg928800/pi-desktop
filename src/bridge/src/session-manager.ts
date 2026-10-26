/**
 * 会话池（design.md §2）：一个会话 = 一个 pi 子进程。
 * 负责把原始记录翻译成事件、维护审批请求的归属、回收进程。
 */
import { access } from "node:fs/promises";
import type { ImagePayload, ModelInfo, ServerEvent } from "@pi-desktop/shared";
import { EventNormalizer } from "./normalize.ts";
import { RpcSession, type RpcSessionInit } from "./rpc-session.ts";

export interface StartOptions {
	sessionId: string;
	taskId: string;
	cwd: string;
	model?: string;
	extraArgs?: string[];
}

interface LiveSession {
	sessionId: string;
	taskId: string;
	cwd: string;
	rpc: RpcSession;
	normalizer: EventNormalizer;
	models: ModelInfo[];
}

export type RpcFactory = (init: RpcSessionInit) => RpcSession;

export class SessionManager {
	private readonly live = new Map<string, LiveSession>();
	private readonly approvalOwner = new Map<string, string>();

	constructor(
		private readonly emit: (event: ServerEvent) => void,
		private readonly rpcFactory: RpcFactory = (init) => new RpcSession(init),
	) {}

	async start(options: StartOptions): Promise<{ sessionId: string; models: ModelInfo[] }> {
		if (this.live.has(options.sessionId)) throw new Error(`session already running: ${options.sessionId}`);
		await access(options.cwd).catch(() => {
			throw new Error(`project root not found: ${options.cwd}`);
		});

		const normalizer = new EventNormalizer(options.sessionId, (event) => {
			if (event.type === "approval.request") {
				this.approvalOwner.set(event.request.requestId, options.sessionId);
			}
			this.emit(event);
		});

		const args = ["--mode", "rpc", "--session-id", options.sessionId];
		if (options.model) args.push("--model", options.model);
		args.push(...(options.extraArgs ?? []));

		const rpc = this.rpcFactory({
			cwd: options.cwd,
			args,
			onRecord: (record) => normalizer.push(record),
			onExit: (code) => {
				this.emit({ type: "session.status", sessionId: options.sessionId, status: code === 0 ? "exited" : "crashed" });
			},
		});
		rpc.start();

		const session: LiveSession = { sessionId: options.sessionId, taskId: options.taskId, cwd: options.cwd, rpc, normalizer, models: [] };
		this.live.set(options.sessionId, session);
		this.emit({ type: "session.status", sessionId: options.sessionId, status: "starting" });

		const state = (await rpc.request("get_state").catch(() => undefined)) as
			| { model?: ModelInfo; cwd?: string }
			| undefined;

		try {
			const catalog = (await rpc.request("get_available_models")) as { models?: ModelInfo[] } | undefined;
			session.models = catalog?.models ?? [];
		} catch {
			session.models = [];
		}

		this.emit({
			type: "session.header",
			sessionId: options.sessionId,
			cwd: state?.cwd ?? options.cwd,
			model: state?.model ?? null,
		});
		this.emit({ type: "session.status", sessionId: options.sessionId, status: "idle" });

		return { sessionId: options.sessionId, models: session.models };
	}

	async prompt(sessionId: string, message: string, images?: ImagePayload[]): Promise<void> {
		const session = this.require(sessionId);
		const payload: Record<string, unknown> = { message };
		if (images?.length) payload.images = images;
		this.emit({ type: "session.status", sessionId, status: "running" });
		await session.rpc.request("prompt", payload);
	}

	async abort(sessionId: string): Promise<void> {
		const session = this.require(sessionId);
		await session.rpc.request("abort");
	}

	/** 审批应答：requestId 决定发给哪个会话 */
	reply(requestId: string, confirmed: boolean): void {
		const sessionId = this.approvalOwner.get(requestId);
		if (!sessionId) throw new Error(`unknown approval request: ${requestId}`);
		this.approvalOwner.delete(requestId);
		this.require(sessionId).rpc.notify({ type: "extension_ui_response", id: requestId, confirmed });
	}

	asset(sessionId: string, ref: string): { data: string; mimeType: string } | undefined {
		return this.live.get(sessionId)?.normalizer.getAsset(ref);
	}

	models(sessionId?: string): ModelInfo[] {
		if (sessionId) return this.live.get(sessionId)?.models ?? [];
		for (const session of this.live.values()) {
			if (session.models.length) return session.models;
		}
		return [];
	}

	list(): Array<{ sessionId: string; taskId: string; cwd: string }> {
		return [...this.live.values()].map(({ sessionId, taskId, cwd }) => ({ sessionId, taskId, cwd }));
	}

	async stopAll(): Promise<void> {
		await Promise.all([...this.live.values()].map((s) => s.rpc.stop(1000).catch(() => {})));
		this.live.clear();
		this.approvalOwner.clear();
	}

	private require(sessionId: string): LiveSession {
		const session = this.live.get(sessionId);
		if (!session) throw new Error(`no such session: ${sessionId}`);
		return session;
	}
}
