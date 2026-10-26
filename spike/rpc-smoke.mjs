/**
 * P0 可行性验证 —— 一次性脚本，验证完即作废。
 *
 * 验证四件事：
 *   A. 字节流按 LF 切帧（含 U+2028 的合成用例）
 *   B. prompt → text_delta 流式 → message_end 权威文本 → agent_settled
 *   C. 多模态：带 images 的 prompt 被接受并产生回答
 *   D. 审批链路：扩展 tool_call → extension_ui_request(confirm) → 应答 → bash 放行
 *
 * 用法：node spike/rpc-smoke.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sandbox = join(here, "sandbox");
const gate = join(here, "confirm-gate.ts");
const results = [];
const t0 = Date.now();

// ---------- 帧解析：按字节 0x0A 切，绝不按字符切 ----------
class FrameSplitter {
	buf = Buffer.alloc(0);
	constructor(onRecord) {
		this.onRecord = onRecord;
		this.records = 0;
	}
	push(chunk) {
		this.buf = Buffer.concat([this.buf, chunk]);
		let idx;
		while ((idx = this.buf.indexOf(0x0a)) !== -1) {
			let line = this.buf.subarray(0, idx);
			this.buf = this.buf.subarray(idx + 1);
			if (line.length > 0 && line[line.length - 1] === 0x0d) line = line.subarray(0, line.length - 1);
			if (line.length === 0) continue;
			this.records++;
			this.onRecord(JSON.parse(line.toString("utf8")));
		}
	}
}

// ---------- A. 切帧合成用例 ----------
{
	const got = [];
	const s = new FrameSplitter((r) => got.push(r));
	const payload = JSON.stringify({ text: "a\u2028b\u2029c", n: 1 });
	s.push(Buffer.from(payload + "\n", "utf8"));
	const ok = got.length === 1 && got[0].text === "a\u2028b\u2029c";
	results.push([
		"A 切帧（含 U+2028/U+2029）",
		ok ? "PASS" : "FAIL",
		ok ? "LF 切分正确，行分隔符未误切" : `解析出 ${got.length} 条，内容不符`,
	]);
	// 分片到达
	const got2 = [];
	const s2 = new FrameSplitter((r) => got2.push(r));
	const buf = Buffer.from(payload + "\n", "utf8");
	for (const b of buf) s2.push(Buffer.from([b]));
	results.push(["A2 逐字节分片重组", got2.length === 1 ? "PASS" : "FAIL", `${buf.length} 字节分片，得到 ${got2.length} 条`]);
}

// ---------- 启动 pi RPC ----------
mkdirSync(sandbox, { recursive: true });

const child = spawn("pi", ["--mode", "rpc", "--no-session", "--extension", gate], {
	cwd: sandbox,
	stdio: ["pipe", "pipe", "pipe"],
	env: { ...process.env },
});

let stderrText = "";
child.stderr.on("data", (d) => {
	stderrText += d.toString();
});

const pending = new Map();
const waiters = [];
let lastSettled = null;
const uiRequests = [];
const gateHits = [];
let textBuffer = "";
let authoritative = "";
const eventKinds = new Set();

function onRecord(rec) {
	if (rec.type === "response") {
		const w = pending.get(rec.id);
		if (w) {
			pending.delete(rec.id);
			rec.success ? w.resolve(rec.data) : w.reject(new Error(rec.error));
		}
		return;
	}
	if (rec.type === "extension_ui_request") {
		uiRequests.push(rec);
		if (rec.method === "notify" && String(rec.message || "").includes("[P0] gate hit")) gateHits.push(rec.message);
		if (rec.method === "confirm") {
			// 这里的应答就是桌面端审批弹窗要发的东西
			send({ type: "extension_ui_response", id: rec.id, confirmed: true });
		}
		return;
	}
	eventKinds.add(rec.type);
	if (rec.type === "message_update" && rec.assistantMessageEvent?.type === "text_delta") {
		textBuffer += rec.assistantMessageEvent.delta;
	}
	if (rec.type === "message_end" && rec.message?.role === "assistant") {
		authoritative = (rec.message.content || [])
			.filter((b) => b.type === "text")
			.map((b) => b.text)
			.join("");
	}
	if (rec.type === "agent_settled") {
		lastSettled = Date.now();
		const w = waiters.shift();
		if (w) w();
	}
}

const splitter = new FrameSplitter(onRecord);
child.stdout.on("data", (chunk) => splitter.push(chunk));

function send(obj) {
	child.stdin.write(JSON.stringify(obj) + "\n");
}

function command(type, extra = {}) {
	const id = `c${Math.random().toString(36).slice(2, 8)}`;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		send({ id, type, ...extra });
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id);
				reject(new Error(`timeout: ${type}`));
			}
		}, 120_000);
	});
}

function waitSettled(timeoutMs = 180_000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timeout waiting agent_settled")), timeoutMs);
		waiters.push(() => {
			clearTimeout(timer);
			resolve();
		});
	});
}

async function ask(message, opts = {}) {
	textBuffer = "";
	authoritative = "";
	lastSettled = null;
	const settled = waitSettled();
	await command("prompt", { message, ...opts });
	await settled;
	return { streamed: textBuffer, final: authoritative };
}

// 1x1 红色 PNG
const RED_PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const report = {};
try {
	// ---------- B. 流式 ----------
	let b, bTime;
	try {
		const t = Date.now();
		b = await ask("只回复两个字：收到。不要使用任何工具。");
		bTime = Date.now() - t;
		const streamedOk = b.streamed.trim().length > 0;
		const finalOk = b.final.trim().length > 0;
		report.text = b.final;
		results.push([
			"B 流式 + 权威消息 + agent_settled",
			streamedOk && finalOk ? "PASS" : "FAIL",
			`delta 拼接 ${b.streamed.length} 字 / message_end ${b.final.length} 字 / ${bTime}ms`,
		]);
	} catch (e) {
		results.push(["B 流式 + 权威消息 + agent_settled", "FAIL", e.message]);
	}

	// ---------- C. 多模态 ----------
	try {
		const t = Date.now();
		const c = await ask("这张图是什么颜色？只回答颜色名。", {
			images: [{ type: "image", data: RED_PNG, mimeType: "image/png" }],
		});
		const ok = c.final.trim().length > 0;
		report.image = c.final;
		results.push(["C 多模态（images 字段）", ok ? "PASS" : "FAIL", `${c.final.slice(0, 40)} / ${Date.now() - t}ms`]);
	} catch (e) {
		results.push(["C 多模态（images 字段）", "FAIL", e.message]);
	}

	// ---------- D. 审批链路 ----------
	try {
		const t = Date.now();
		const d = await ask(
			"用 bash 工具执行下面这一条命令，原样执行不要改写、不要加东西：\n\nP0_APPROVE=1 echo P0_APPROVE_OK\n\n执行完把输出贴给我。",
		);
		const hit = gateHits.length > 0;
		const ran = /P0_APPROVE_OK/.test(d.final) || /P0_APPROVE_OK/.test(d.streamed);
		results.push([
			"D 审批链路（tool_call → confirm → 放行）",
			hit && ran ? "PASS" : "FAIL",
			`gate 命中 ${gateHits.length} 次 / 命令输出可见 ${ran} / UI 请求 ${uiRequests.length} 个 / ${Date.now() - t}ms`,
		]);
		report.approval = d.final.slice(0, 200);
	} catch (e) {
		results.push(["D 审批链路（tool_call → confirm → 放行）", "FAIL", e.message]);
		report.approval = `ERROR: ${e.message}`;
	}

	// ---------- 状态 ----------
	try {
		const st = await command("get_state");
		const models = await command("get_available_models");
		const imageModels = (models?.models || []).filter((m) => (m.input || []).includes("image")).length;
		results.push([
			"E get_state / get_available_models",
			st && models ? "PASS" : "FAIL",
			`model=${st?.model ? `${st.model.provider}/${st.model.id}` : "?"} / 可选模型 ${(models?.models || []).length} 个（其中支持图片 ${imageModels} 个）`,
		]);
		report.state = st;
	} catch (e) {
		results.push(["E get_state / get_available_models", "FAIL", e.message]);
	}
} finally {
	const elapsed = Date.now() - t0;
	const total = splitter.records;
	child.stdin.end();
	child.kill("SIGTERM");

	const lines = [];
	lines.push("# P0 可行性验证结果", "");
	lines.push(`- 时间：${new Date().toISOString()}`);
	lines.push(`- 总耗时：${elapsed} ms，收到协议记录 ${total} 条`);
	lines.push(`- 事件类型：${[...eventKinds].sort().join(", ")}`);
	lines.push("", "| 项 | 结果 | 说明 |", "| --- | --- | --- |");
	for (const [name, status, detail] of results) lines.push(`| ${name} | ${status} | ${detail} |`);
	lines.push("", "## 说明", "");
	lines.push("- 本目录（spike/）是验证脚本，结论产出后即可删除或归档。");
	if (stderrText.trim()) lines.push("", "## stderr（前 2000 字）", "", "```", stderrText.slice(0, 2000), "```");

	const out = lines.join("\n") + "\n";
	writeFileSync(join(here, "P0-RESULTS.md"), out);
	process.stdout.write(out);
}
