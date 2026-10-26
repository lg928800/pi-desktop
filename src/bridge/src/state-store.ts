/**
 * 任务层级元数据存储（design.md §4）。
 *
 * 三条纪律：
 *  - 只存 UI 元数据，不存会话内容（会话以 pi 的 jsonl 为准）。
 *  - 写盘用 tmp + rename，崩溃不留半截文件。
 *  - 读盘失败不抛给上层：备份坏文件、返回空状态，让用户看到"空"而不是白屏。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { StateFile } from "@pi-desktop/shared";

export const STATE_VERSION = 1 as const;

export function emptyState(): StateFile {
	return { version: STATE_VERSION, projects: [], features: [], tasks: [], sessions: [] };
}

export type StateMutation = (state: StateFile) => StateFile | void;

export interface LoadIssue {
	kind: "not-found" | "unreadable" | "version-mismatch";
	backupPath?: string;
	detail?: string;
}

export class StateStore {
	private state: StateFile | undefined;
	private queue: Promise<unknown> = Promise.resolve();
	lastIssue: LoadIssue | undefined;

	constructor(private readonly filePath: string) {}

	async load(): Promise<StateFile> {
		if (this.state) return this.state;
		this.lastIssue = undefined;

		let raw: string;
		try {
			raw = await readFile(this.filePath, "utf8");
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			this.lastIssue = { kind: code === "ENOENT" ? "not-found" : "unreadable", detail: String(error) };
			this.state = emptyState();
			return this.state;
		}

		let parsed: StateFile;
		try {
			parsed = JSON.parse(raw) as StateFile;
		} catch (error) {
			const backupPath = await this.backup(raw, "corrupt");
			this.lastIssue = { kind: "unreadable", backupPath, detail: String(error) };
			this.state = emptyState();
			return this.state;
		}

		if (parsed.version !== STATE_VERSION) {
			const backupPath = await this.backup(raw, `v${String(parsed.version)}`);
			this.lastIssue = {
				kind: "version-mismatch",
				backupPath,
				detail: `expected version ${STATE_VERSION}, found ${String(parsed.version)}`,
			};
			this.state = emptyState();
			return this.state;
		}

		this.state = normalize(parsed);
		return this.state;
	}

	/** 串行化所有写操作，避免并发 update 互相覆盖 */
	update(mutation: StateMutation): Promise<StateFile> {
		const run = this.queue.then(async () => {
			const current = await this.load();
			const next = mutation(current) ?? current;
			this.state = next;
			await this.persist(next);
			return next;
		});
		this.queue = run.catch(() => undefined);
		return run;
	}

	private async persist(state: StateFile): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		const tmp = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
		await writeFile(tmp, `${JSON.stringify(state, null, "\t")}\n`, "utf8");
		await rename(tmp, this.filePath);
	}

	private async backup(raw: string, tag: string): Promise<string> {
		const backupPath = `${this.filePath}.bak-${tag}-${Date.now()}`;
		await mkdir(dirname(this.filePath), { recursive: true });
		await writeFile(backupPath, raw, "utf8");
		return backupPath;
	}
}

function normalize(state: StateFile): StateFile {
	return {
		version: STATE_VERSION,
		projects: Array.isArray(state.projects) ? state.projects : [],
		features: Array.isArray(state.features) ? state.features : [],
		tasks: Array.isArray(state.tasks) ? state.tasks : [],
		sessions: Array.isArray(state.sessions) ? state.sessions : [],
	};
}
