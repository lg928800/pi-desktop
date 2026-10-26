import { useRef, useState } from "react";

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
	const textarea = useRef<HTMLTextAreaElement>(null);

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
		if (textarea.current) textarea.current.style.height = "auto";
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
						<span key={`${a.name}-${i}`} className="chip">
							🖼 {a.name}
							<button onClick={() => setAttachments((c) => c.filter((_, j) => j !== i))}>×</button>
						</span>
					))}
				</div>
			)}

			<div className={`composer-box ${disabled ? "disabled" : ""}`}>
				<textarea
					ref={textarea}
					rows={1}
					value={text}
					disabled={disabled}
					placeholder={disabled ? "先选任务并开会话" : "输入指令，可粘贴图片…"}
					onChange={(event) => setText(event.target.value)}
					onInput={(event) => {
						const el = event.currentTarget;
						el.style.height = "auto";
						el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							void submit();
						}
					}}
				/>

				<div className="composer-foot">
					<span className="hint-text">
						{error ? <span className="bad-text">{error}</span> : "Enter 发送 · Shift+Enter 换行 · 支持粘贴图片"}
					</span>
					{running ? (
						<button className="ghost-btn danger" onClick={() => void onAbort()}>
							中断
						</button>
					) : (
						<button className="send-btn" onClick={() => void submit()} disabled={disabled} title="发送">
							<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
								<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
							</svg>
						</button>
					)}
				</div>
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
