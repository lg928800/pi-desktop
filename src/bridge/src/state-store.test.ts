import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StateStore, emptyState, STATE_VERSION } from "./state-store.ts";

async function tempStore() {
	const dir = await mkdtemp(join(tmpdir(), "pidesk-state-"));
	const file = join(dir, "state.json");
	return { dir, file, store: new StateStore(file) };
}

describe("StateStore", () => {
	it("文件不存在时返回空状态，且不写盘", async () => {
		const { dir, store } = await tempStore();
		const state = await store.load();
		expect(state).toEqual(emptyState());
		expect(store.lastIssue?.kind).toBe("not-found");
		expect(await readdir(dir)).toEqual([]);
	});

	it("保存后可往返读取", async () => {
		const { file, store } = await tempStore();
		await store.update((s) => {
			s.projects.push({ id: "p1", name: "demo", root: "/tmp/demo", defaults: { permission: "L2" } });
		});
		const reloaded = new StateStore(file);
		const state = await reloaded.load();
		expect(state.projects).toHaveLength(1);
		expect(state.projects[0]?.name).toBe("demo");
	});

	it("并发 update 不丢更新", async () => {
		const { file, store } = await tempStore();
		await Promise.all(
			Array.from({ length: 20 }, (_, i) =>
				store.update((s) => {
					s.projects.push({ id: `p${i}`, name: `n${i}`, root: "/tmp", defaults: { permission: "L1" } });
				}),
			),
		);
		const state = await new StateStore(file).load();
		expect(state.projects).toHaveLength(20);
	});

	it("坏 JSON：备份原文件、返回空状态、不抛异常", async () => {
		const { dir, file, store } = await tempStore();
		await writeFile(file, "{ broken", "utf8");
		const state = await store.load();
		expect(state).toEqual(emptyState());
		expect(store.lastIssue?.kind).toBe("unreadable");
		const backups = (await readdir(dir)).filter((f) => f.includes(".bak-corrupt-"));
		expect(backups).toHaveLength(1);
		expect(await readFile(join(dir, backups[0]!), "utf8")).toBe("{ broken");
	});

	it("版本不符：备份并重建", async () => {
		const { dir, file, store } = await tempStore();
		await writeFile(file, JSON.stringify({ version: 99, projects: [{ id: "x" }] }), "utf8");
		const state = await store.load();
		expect(state.version).toBe(STATE_VERSION);
		expect(state.projects).toEqual([]);
		expect(store.lastIssue?.kind).toBe("version-mismatch");
		expect((await readdir(dir)).some((f) => f.includes(".bak-v99-"))).toBe(true);
	});

	it("字段缺失时归一化，不崩溃", async () => {
		const { file, store } = await tempStore();
		await writeFile(file, JSON.stringify({ version: STATE_VERSION }), "utf8");
		const state = await store.load();
		expect(state).toEqual(emptyState());
	});

	it("写入后不残留 tmp 文件", async () => {
		const { dir, store } = await tempStore();
		await store.update((s) => {
			s.features.push({ id: "f1", projectId: "p1", name: "feat" });
		});
		const files = await readdir(dir);
		expect(files).toEqual(["state.json"]);
	});
});
