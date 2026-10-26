import { useState } from "react";

export interface AddModelValues {
	provider: string;
	baseUrl: string;
	api: string;
	modelId: string;
	name?: string;
	apiKey?: string;
	image?: boolean;
}

interface Props {
	onCancel: () => void;
	onSubmit: (values: AddModelValues) => Promise<{ path: string; backupPath?: string }>;
	onRestart: () => Promise<void>;
}

const APIS = ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"];

export function AddModelDialog({ onCancel, onSubmit, onRestart }: Props) {
	const [values, setValues] = useState<AddModelValues>({ provider: "", baseUrl: "", api: APIS[0]!, modelId: "" });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState<{ path: string; backupPath?: string } | null>(null);

	const set = (patch: Partial<AddModelValues>) => setValues((current) => ({ ...current, ...patch }));

	async function submit() {
		if (!values.provider.trim() || !values.baseUrl.trim() || !values.modelId.trim()) {
			setError("provider / baseUrl / 模型 ID 都必填");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			setSaved(await onSubmit(values));
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
			<div className="modal create-modal">
				<h2>配置新模型</h2>
				<p className="dim small">
					写入 pi 的 <code className="inline-code">~/.pi/agent/models.json</code>，改动前自动备份。
				</p>

				{!saved ? (
					<>
						<div className="grid-2">
							<label className="field">
								<span>Provider ID</span>
								<input value={values.provider} placeholder="my-gateway" onChange={(e) => set({ provider: e.target.value })} />
							</label>
							<label className="field">
								<span>模型 ID</span>
								<input value={values.modelId} placeholder="gpt-5.1" onChange={(e) => set({ modelId: e.target.value })} />
							</label>
						</div>

						<label className="field">
							<span>Base URL</span>
							<input value={values.baseUrl} placeholder="https://api.example.com/v1" onChange={(e) => set({ baseUrl: e.target.value })} />
						</label>

						<div className="grid-2">
							<label className="field">
								<span>API 协议</span>
								<select value={values.api} onChange={(e) => set({ api: e.target.value })}>
									{APIS.map((api) => (
										<option key={api} value={api}>
											{api}
										</option>
									))}
								</select>
							</label>
							<label className="field">
								<span>显示名（可选）</span>
								<input value={values.name ?? ""} placeholder="默认用模型 ID" onChange={(e) => set({ name: e.target.value })} />
							</label>
						</div>

						<label className="field">
							<span>API Key（可选，支持 $ENV_VAR 引用环境变量）</span>
							<input
								type="password"
								value={values.apiKey ?? ""}
								placeholder="sk-... 或 $MY_API_KEY"
								onChange={(e) => set({ apiKey: e.target.value })}
							/>
						</label>

						<label className="check">
							<input type="checkbox" checked={Boolean(values.image)} onChange={(e) => set({ image: e.target.checked })} />
							<span>支持图片输入（多模态）</span>
						</label>

						{error && <p className="bad-text small">{error}</p>}

						<div className="modal-actions">
							<button onClick={onCancel} disabled={busy}>
								取消
							</button>
							<button className="primary" onClick={() => void submit()} disabled={busy}>
								{busy ? "写入中…" : "保存"}
							</button>
						</div>
					</>
				) : (
					<>
						<p className="ok-text small">已写入：{saved.path}</p>
						{saved.backupPath && <p className="dim small">备份：{saved.backupPath}</p>}
						<p className="small">pi 只在进程启动时读取模型配置，需要重启当前会话才会出现。</p>
						<div className="modal-actions">
							<button onClick={onCancel}>稍后</button>
							<button
								className="primary"
								onClick={async () => {
									await onRestart();
									onCancel();
								}}
							>
								重启会话并生效
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
