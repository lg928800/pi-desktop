import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "jsonc-parser";
import { addModelToConfig } from "./model-config.ts";

const ORIGINAL = `{
	// 这行注释必须保留
	"providers": {
		"zai-lan": {
			"name": "内网网关", // 行尾注释
			"baseUrl": "http://example.internal/v1",
			"api": "openai-completions",
			"models": [{ "id": "glm-5.3-flash", "input": ["text", "image"] }]
		}
	}
}
`;

async function tempFile(content?: string) {
	const dir = await mkdtemp(join(tmpdir(), "pidesk-models-"));
	const path = join(dir, "models.json");
	if (content !== undefined) await writeFile(path, content, "utf8");
	return { dir, path };
}

describe("addModelToConfig", () => {
	it("新增 provider 且保留原注释", async () => {
		const { path } = await tempFile(ORIGINAL);
		await addModelToConfig(path, {
			provider: "my-gateway",
			baseUrl: "https://api.example.com/v1",
			api: "openai-completions",
			modelId: "gpt-x",
			image: true,
		});

		const text = await readFile(path, "utf8");
		expect(text).toContain("这行注释必须保留");
		expect(text).toContain("行尾注释");
		const parsed = parse(text) as any;
		expect(parsed.providers["my-gateway"].models[0]).toEqual({ id: "gpt-x", input: ["text", "image"] });
		expect(parsed.providers["zai-lan"].models[0].id).toBe("glm-5.3-flash");
	});

	it("往已有 provider 追加模型，不覆盖已有模型", async () => {
		const { path } = await tempFile(ORIGINAL);
		await addModelToConfig(path, {
			provider: "zai-lan",
			baseUrl: "http://example.internal/v1",
			api: "openai-completions",
			modelId: "glm-5.4",
		});
		const parsed = parse(await readFile(path, "utf8")) as any;
		expect(parsed.providers["zai-lan"].models.map((m: { id: string }) => m.id)).toEqual(["glm-5.3-flash", "glm-5.4"]);
	});

	it("同名模型是替换而不是重复", async () => {
		const { path } = await tempFile(ORIGINAL);
		await addModelToConfig(path, {
			provider: "zai-lan",
			baseUrl: "http://example.internal/v1",
			api: "openai-completions",
			modelId: "glm-5.3-flash",
			name: "改名了",
		});
		const parsed = parse(await readFile(path, "utf8")) as any;
		const models = parsed.providers["zai-lan"].models;
		expect(models).toHaveLength(1);
		expect(models[0].name).toBe("改名了");
	});

	it("文件不存在时创建骨架", async () => {
		const { path } = await tempFile();
		const result = await addModelToConfig(path, {
			provider: "p",
			baseUrl: "https://x/v1",
			api: "openai-completions",
			modelId: "m",
		});
		expect(result.backupPath).toBeUndefined();
		const parsed = JSON.parse(await readFile(path, "utf8"));
		expect(parsed.providers.p.models[0].id).toBe("m");
	});

	it("修改前留下备份", async () => {
		const { path } = await tempFile(ORIGINAL);
		const result = await addModelToConfig(path, {
			provider: "p",
			baseUrl: "https://x/v1",
			api: "openai-completions",
			modelId: "m",
		});
		expect(result.backupPath).toBeTruthy();
		expect(await readFile(result.backupPath!, "utf8")).toBe(ORIGINAL);
	});
});
