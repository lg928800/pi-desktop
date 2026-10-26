/**
 * 一个 pi RPC 子进程的包装（design.md §2）。
 *
 * 职责：spawn、帧解析、命令 id 关联、超时、stderr 留存、退出状态。
 * 不做事件语义翻译（那是 normalize.ts 的事），也不碰 WS。
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { FrameSplitter, type JsonRecord } from "./frame-splitter.ts";

export type RpcSessionStatus = "starting" | "idle" | "running" | "crashed" | "exited";

export interface RpcSessionInit {
	cwd: string;
	/** 默认 "pi"；测试可指向 fake-pi.mjs */
	command?: string;
	args?: string[];
	env?: NodeJS.ProcessEnv;
	commandTimeoutMs?: number;
	onRecord?: (record: JsonRecord) => void;
	onStderr?: (text: string) => void;
	onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

interface Pending {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

const DEFAULT_ARGS = ["--mode", "rpc", "--no-session"];
const STDERR_TAIL_BYTES = 8192;

export class RpcSession {
	status: RpcSessionStatus = "idle";
	stderrTail = "";

	private child?: ChildProcessWithoutNullStreams;
	private closed = false;
	private readonly pending = new Map<string, Pending>();
	private seq = 0;
	private readonly splitter: FrameSplitter;
	private readonly timeoutMs: number;

	constructor(private readonly init: RpcSessionInit) {
		this.timeoutMs = init.commandTimeoutMs ?? 30_000;
		this.splitter = new FrameSplitter(
			(record) => this.handleRecord(record),
			{ onError: (error) => this.init.onStderr?.(`[frame] ${error.message}\n`) },
		);
	}

	start(): void {
		if (this.child) throw new Error("already started");
		this.status = "starting";

		const command = this.init.command ?? "pi";
		const args = this.init.args ?? DEFAULT_ARGS;
		const child = spawn(command, args, {
			cwd: this.init.cwd,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, ...this.init.env },
			// Windows 上 pi 实为 pi.cmd，需要 shell；其余平台保持直接 exec
			shell: process.platform === "win32",
		}) as ChildProcessWithoutNullStreams;

		this.child = child;
		this.status = "idle";

		child.stdout.on("data", (chunk: Buffer) => this.splitter.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => {
			const text = chunk.toString("utf8");
			this.stderrTail = (this.stderrTail + text).slice(-STDERR_TAIL_BYTES);
			this.init.onStderr?.(text);
		});
		child.on("error", (error) => {
			this.status = "crashed";
			this.failAll(error);
			this.init.onExit?.(null, null);
		});
		child.on("exit", (code, signal) => {
			this.closed = true;
			this.status = code === 0 ? "exited" : "crashed";
			this.failAll(new Error(`pi exited (code=${code}, signal=${signal})`));
			this.init.onExit?.(code, signal);
		});
	}

	/** 有应答的命令；按 id 关联，超时即拒绝 */
	request<T = unknown>(type: string, payload: Record<string, unknown> = {}, timeoutMs = this.timeoutMs): Promise<T> {
		const child = this.requireChild();
		const id = `c${++this.seq}`;
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`timeout after ${timeoutMs}ms: ${type} (${id})`));
			}, timeoutMs);
			this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
			child.stdin.write(`${JSON.stringify({ id, type, ...payload })}\n`);
		});
	}

	/** 无应答的记录（如 extension_ui_response）：fire-and-forget */
	notify(record: Record<string, unknown>): void {
		this.requireChild().stdin.write(`${JSON.stringify(record)}\n`);
	}

	async stop(graceMs = 3000): Promise<void> {
		const child = this.child;
		if (!child) return;
		if (this.closed) {
			this.child = undefined;
			return;
		}
		child.stdin.end();
		const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
		const timer = setTimeout(() => child.kill("SIGKILL"), graceMs);
		await exited;
		clearTimeout(timer);
		this.child = undefined;
	}

	private handleRecord(record: JsonRecord): void {
		if (record.type === "response") {
			const id = record.id;
			if (typeof id !== "string") return;
			const entry = this.pending.get(id);
			if (!entry) return;
			this.pending.delete(id);
			clearTimeout(entry.timer);
			if (record.success === false) entry.reject(new Error(String(record.error ?? "command failed")));
			else entry.resolve(record.data);
			return;
		}
		this.init.onRecord?.(record);
	}

	private failAll(error: Error): void {
		for (const [, entry] of this.pending) {
			clearTimeout(entry.timer);
			entry.reject(error);
		}
		this.pending.clear();
	}

	private requireChild(): ChildProcessWithoutNullStreams {
		if (!this.child) throw new Error("pi process not started");
		if (this.status === "crashed" || this.status === "exited") throw new Error(`pi process not available (${this.status})`);
		return this.child;
	}
}
