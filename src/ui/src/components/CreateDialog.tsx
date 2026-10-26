import { useEffect, useRef, useState } from "react";

export type CreateKind = "project" | "feature" | "task";

export interface CreateRequest {
	kind: CreateKind;
	/** feature 需要 projectId；task 需要 featureId */
	parentId?: string;
	parentName?: string;
}

interface Props {
	request: CreateRequest;
	onCancel: () => void;
	onSubmit: (values: { name: string; root?: string }) => Promise<void>;
}

const TITLE: Record<CreateKind, string> = {
	project: "新建项目",
	feature: "新建功能集",
	task: "新建任务",
};

/**
 * 内联新建表单。
 * 不用 window.prompt：WKWebView 不实现它，桌面端会静默失败。
 */
export function CreateDialog({ request, onCancel, onSubmit }: Props) {
	const [name, setName] = useState("");
	const [root, setRoot] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const firstInput = useRef<HTMLInputElement>(null);
	const [picking, setPicking] = useState(false);
	const canPickFolder = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

	useEffect(() => {
		firstInput.current?.focus();
	}, [request.kind]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onCancel]);

	/** 原生「选择文件夹」（Tauri dialog 插件）；浏览器里没有这条能力 */
	async function pickFolder() {
		setPicking(true);
		setError(null);
		try {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const selected = await open({ directory: true, multiple: false, title: "选择项目根目录" });
			if (typeof selected === "string" && selected) {
				setRoot(selected);
				if (!name.trim()) setName(selected.split("/").filter(Boolean).at(-1) ?? "");
			}
		} catch (e) {
			setError(`无法打开目录选择器：${(e as Error).message}`);
		} finally {
			setPicking(false);
		}
	}

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed) {
			setError("名称不能为空");
			return;
		}
		if (request.kind === "project" && !root.trim()) {
			setError("请填写项目根目录（绝对路径）");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await onSubmit({ name: trimmed, root: request.kind === "project" ? root.trim() : undefined });
		} catch (e) {
			setError((e as Error).message);
			setBusy(false);
		}
	}

	return (
		<div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
			<div className="modal create-modal">
				<h2>{TITLE[request.kind]}</h2>
				{request.parentName && <p className="dim small">上级：{request.parentName}</p>}

				<label className="field">
					<span>{request.kind === "task" ? "任务标题" : "名称"}</span>
					<input
						ref={firstInput}
						value={name}
						placeholder={request.kind === "project" ? "pi-desktop" : request.kind === "feature" ? "登录重构" : "拆出 AuthService"}
						onChange={(event) => setName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && request.kind !== "project") void submit();
						}}
					/>
				</label>

				{request.kind === "project" && (
					<label className="field">
						<span>根目录</span>
						<div className="field-row">
							<input
								value={root}
								placeholder="/Users/you/onlyProject/my-app"
								onChange={(event) => setRoot(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") void submit();
								}}
							/>
							{canPickFolder ? (
								<button type="button" onClick={() => void pickFolder()} disabled={picking}>
									{picking ? "选择中…" : "选择…"}
								</button>
							) : (
								<span className="dim small">桌面端可点选择目录</span>
							)}
						</div>
					</label>
				)}

				{error && <p className="bad-text small">{error}</p>}

				<div className="modal-actions">
					<button onClick={onCancel} disabled={busy}>
						取消
					</button>
					<button className="primary" onClick={() => void submit()} disabled={busy}>
						{busy ? "创建中…" : "创建"}
					</button>
				</div>
			</div>
		</div>
	);
}
