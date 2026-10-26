interface Props {
	taskTitle: string | null;
	status: string;
	rightOpen: boolean;
	onToggleRight: () => void;
}

const STATUS_TEXT: Record<string, string> = {
	idle: "空闲",
	starting: "启动中",
	running: "执行中",
	crashed: "已崩溃",
	exited: "已退出",
};

const STATUS_TONE: Record<string, string> = {
	idle: "muted",
	starting: "warn",
	running: "ok",
	crashed: "bad",
	exited: "muted",
};

export function TitleBar({ taskTitle, status, rightOpen, onToggleRight }: Props) {
	const isMac = /Mac/i.test(navigator.userAgent);

	return (
		<header className={`titlebar ${isMac ? "is-mac" : ""}`} data-tauri-drag-region>
			<div className="titlebar-brand" data-tauri-drag-region>
				<span className="brand-mark" aria-hidden />
				<span className="brand-name">pi-desktop</span>
			</div>

			<div className="titlebar-center" data-tauri-drag-region>
				{taskTitle ?? "未选择任务"}
			</div>

			<div className="titlebar-actions">
				<span className={`pill ${STATUS_TONE[status] ?? "muted"}`}>{STATUS_TEXT[status] ?? status}</span>
				<button
					className={`icon-btn ${rightOpen ? "on" : ""}`}
					onClick={onToggleRight}
					title={rightOpen ? "折叠右栏" : "展开右栏"}
					aria-label="切换右栏"
				>
					<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
						<rect x="1.5" y="2.5" width="13" height="11" rx="2" />
						<path d="M10 2.5v11" />
					</svg>
				</button>
			</div>
		</header>
	);
}
