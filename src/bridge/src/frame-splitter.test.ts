import { describe, expect, it } from "vitest";
import { FrameSplitter, type JsonRecord } from "./frame-splitter.ts";

function collect() {
	const records: JsonRecord[] = [];
	const errors: Error[] = [];
	const splitter = new FrameSplitter((r) => records.push(r), { onError: (e) => errors.push(e) });
	return { records, errors, splitter };
}

describe("FrameSplitter", () => {
	it("解析单条记录", () => {
		const { records, splitter } = collect();
		splitter.push(Buffer.from('{"type":"agent_start"}\n', "utf8"));
		expect(records).toEqual([{ type: "agent_start" }]);
	});

	it("接受 CRLF 行尾", () => {
		const { records, splitter } = collect();
		splitter.push(Buffer.from('{"a":1}\r\n{"a":2}\r\n', "utf8"));
		expect(records).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it("字符串里的 U+2028 / U+2029 不能被当成行尾", () => {
		const { records, splitter } = collect();
		const payload = JSON.stringify({ text: "行一\u2028行二\u2029行三" });
		splitter.push(Buffer.from(`${payload}\n`, "utf8"));
		expect(records).toHaveLength(1);
		expect(records[0]?.text).toBe("行一\u2028行二\u2029行三");
	});

	it("逐字节分片也能重组", () => {
		const { records, splitter } = collect();
		const payload = JSON.stringify({ text: "中文字符🙂", n: 7 });
		for (const byte of Buffer.from(`${payload}\n`, "utf8")) {
			splitter.push(Buffer.from([byte]));
		}
		expect(records).toEqual([{ text: "中文字符🙂", n: 7 }]);
		expect(splitter.pendingBytes).toBe(0);
	});

	it("一个 chunk 里多条记录", () => {
		const { records, splitter } = collect();
		splitter.push(Buffer.from('{"n":1}\n{"n":2}\n{"n":3}\n', "utf8"));
		expect(records.map((r) => r.n)).toEqual([1, 2, 3]);
	});

	it("半条记录留在缓冲区，补齐后再解析", () => {
		const { records, splitter } = collect();
		splitter.push(Buffer.from('{"n":', "utf8"));
		expect(records).toHaveLength(0);
		expect(splitter.pendingBytes).toBe(5);
		splitter.push(Buffer.from("42}\n", "utf8"));
		expect(records).toEqual([{ n: 42 }]);
	});

	it("空行忽略", () => {
		const { records, errors, splitter } = collect();
		splitter.push(Buffer.from('\n\n{"n":1}\n\n', "utf8"));
		expect(records).toEqual([{ n: 1 }]);
		expect(errors).toHaveLength(0);
	});

	it("坏 JSON 走 onError，不打断后续记录", () => {
		const { records, errors, splitter } = collect();
		splitter.push(Buffer.from('{oops}\n{"n":9}\n', "utf8"));
		expect(errors).toHaveLength(1);
		expect(records).toEqual([{ n: 9 }]);
	});

	it("超长行触发保护并丢弃缓冲", () => {
		const errors: Error[] = [];
		const splitter = new FrameSplitter(() => {}, { maxLineBytes: 32, onError: (e) => errors.push(e) });
		splitter.push(Buffer.from("x".repeat(64), "utf8"));
		expect(errors).toHaveLength(1);
		expect(splitter.pendingBytes).toBe(0);
	});
});
