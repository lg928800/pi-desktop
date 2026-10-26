/**
 * 往 pi 的 models.json 里追加 provider / model。
 *
 * models.json 是 **JSONC**（带注释）。直接 JSON.parse + stringify 会把用户注释全抹掉，
 * 所以这里用 jsonc-parser 做局部修改，只替换被编辑的那个节点。
 */
import { readFile, writeFile } from "node:fs/promises";
import { applyEdits, modify, parse } from "jsonc-parser";

export interface AddModelInput {
	provider: string;
	baseUrl: string;
	api: string;
	modelId: string;
	name?: string;
	apiKey?: string;
	image?: boolean;
}

const FORMAT = { insertSpaces: true, tabSize: 2, eol: "\n" } as const;

const SKELETON = `{
	"$schema": "https://pi.dev/schemas/models.schema.json",
	"providers": {}
}
`;

export async function addModelToConfig(path: string, input: AddModelInput): Promise<{ backupPath?: string }> {
	let text = "";
	try {
		text = await readFile(path, "utf8");
	} catch {
		text = SKELETON;
	}
	if (!text.trim()) text = SKELETON;

	const parsed = (parse(text) ?? {}) as { providers?: Record<string, Record<string, unknown>> };
	const existing = parsed.providers?.[input.provider] ?? {};
	const models = Array.isArray(existing.models) ? (existing.models as Array<Record<string, unknown>>) : [];

	const model: Record<string, unknown> = { id: input.modelId, input: input.image ? ["text", "image"] : ["text"] };
	if (input.name) model.name = input.name;

	const nextModels = [...models.filter((item) => item.id !== input.modelId), model];
	const nextProvider = {
		...existing,
		name: existing.name ?? input.provider,
		baseUrl: input.baseUrl,
		api: input.api,
		...(input.apiKey ? { apiKey: input.apiKey } : {}),
		models: nextModels,
	};

	const edits = modify(text, ["providers", input.provider], nextProvider, { formattingOptions: FORMAT });
	if (edits.length === 0) throw new Error("写入 models.json 失败：未产生任何修改");

	// 先备份再写，坏了好回滚
	let backupPath: string | undefined;
	if (text !== SKELETON) {
		backupPath = `${path}.bak-${Date.now()}`;
		await writeFile(backupPath, text, "utf8");
	}
	await writeFile(path, applyEdits(text, edits), "utf8");
	return { backupPath };
}
