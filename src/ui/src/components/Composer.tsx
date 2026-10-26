import { useState } from "react";

interface Props {
	disabled: boolean;
	running: boolean;
	onSend: (text: string, images: Array<{ type: "image"; data: string; mimeType: string }>) => Promise<void>;
	onAbort: () => Promise<void>;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface Attachment {
	name: string;
	mimeType: string;
	data: string;
}

export function Composer({ disabled, running, onSend, onAbort }: Props) {
	const [text, setText] = useState("");
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [error, setError] = useState<string | null>(null);

	async function addFiles(files: FileList | File[]) {
		const next: Attachment[] = [];
		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) continue;
			if (file.size > MAX_IMAGE_BYTES) {
				setError(`图片超过 8MB：${file.name}`);
				continue;
			}
			next.push({ name: file.name, mimeType: file.type, data: await toBase64(file) });
		}
		if (next.length) setAttachments((current) => [...current, ...next]);
	}

	async function submit() {
		const trimmed = text.trim();
		if (!trimmed && attachments.length === 0) return;
		setText("");
		setError(null);
		const images = attachments.map((a) => ({ type: "image" as const, data: a.data, mimeType: a.mimeType }));
		setAttachments([]);
		await onSend(trimmed, images);
	}

	return (
		<div
			className="composer"
			onPaste={(event) => {
				if (event.clipboardData.files.length) void addFiles(event.clipboardData.files);
			}}
			onDragOver={(event) => event.preventDefault()}
			onDrop={(event) => {
				event.preventDefault();
				void addFiles(event.dataTransfer.files);
			}}
		>
			{attachments.length > 0 && (
				<div className="attachments">
					{attachments.map((a, i) => (
						<span key={`${a.name}-${i}`} className="img-chip">
							🖼 {a.name}
							<button onClick={() => setAttachments((c) => c.filter((_, j) => j !== i))}>×</button>
						</span>
					))}
				</div>
			)}
			{error && <div className="error">{error}</div>}

			<div className="composer-row">
				<textarea
					value={text}
					disabled={disabled}
					placeholder={disabled ? "先选任务并开会话" : "输入指令…（Enter 发送 / Shift+Enter 换行 / 可粘贴图片）"}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							void submit();
						}
					}}
				/>
				{running ? (
					<button className="danger" onClick={() => void onAbort()}>
						中断
					</button>
				) : (
					<button onClick={() => void submit()} disabled={disabled}>
						发送
					</button>
				)}
			</div>
		</div>
	);
}

function toBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
