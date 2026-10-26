/**
 * JSONL 帧解析（design.md §3 / AGENTS.md 红线 3）。
 *
 * 只按字节 0x0A 切分，绝不用 readline / split("\n") 之后的字符级处理：
 * U+2028(U+2029) 是合法 JSON 字符串内容，readline 会把它也当行尾。
 */

export interface JsonRecord {
	type?: string;
	[key: string]: unknown;
}

export interface FrameSplitterOptions {
	/** 单行上限，超出视为协议故障（防止无换行输出把内存吃光） */
	maxLineBytes?: number;
	onError?: (error: Error) => void;
}

export class FrameSplitter {
	private buf: Buffer = Buffer.alloc(0);
	private readonly maxLineBytes: number;
	private readonly onError?: (error: Error) => void;

	constructor(
		private readonly onRecord: (record: JsonRecord) => void,
		options: FrameSplitterOptions = {},
	) {
		this.maxLineBytes = options.maxLineBytes ?? 8 * 1024 * 1024;
		this.onError = options.onError;
	}

	get pendingBytes(): number {
		return this.buf.length;
	}

	push(chunk: Buffer): void {
		this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);

		for (;;) {
			const idx = this.buf.indexOf(0x0a);
			if (idx === -1) break;

			let line = this.buf.subarray(0, idx);
			this.buf = this.buf.subarray(idx + 1);
			if (line.length > 0 && line[line.length - 1] === 0x0d) line = line.subarray(0, line.length - 1);
			if (line.length === 0) continue;

			let parsed: JsonRecord;
			try {
				parsed = JSON.parse(line.toString("utf8")) as JsonRecord;
			} catch (error) {
				this.report(new Error(`invalid JSON frame (${line.length}B): ${(error as Error).message}`));
				continue;
			}
			this.onRecord(parsed);
		}

		if (this.buf.length > this.maxLineBytes) {
			const size = this.buf.length;
			this.buf = Buffer.alloc(0);
			this.report(new Error(`frame exceeded ${this.maxLineBytes}B (${size}B buffered), buffer dropped`));
		}
	}

	private report(error: Error): void {
		if (this.onError) this.onError(error);
		else throw error;
	}
}
