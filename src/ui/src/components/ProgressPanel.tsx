import type { ModelInfo, Task } from "@pi-desktop/shared";
import type { SessionView } from "../lib/session-view.ts";

interface Props {
	view: SessionView;
	task: Task | null;
	models: ModelInfo[];
}

const PHASE: Record<string, { text: string; tone: string }> = {
	idle: { text: "空闲", tone: "muted" },
	starting: { text: "启动中", tone: "warn" },
	running: { text: "执行中", tone: "ok" },
	crashed: { text: "已崩溃", tone: "bad" },
	exited: { text: "已退出", tone: "muted" },
};

export function ProgressPanel({ view, task, models }: Props) {
	const tools = view.items.filter((item) => item.kind === "tool");
	const running = tools.filter((item) => item.status === "running").length;
	const failed = tools.filter((item) => item.status === "error").length;
	const model = view.model;
	const imageCapable = model?.input?.includes("image") ?? false;
	const phase = PHASE[view.status] ?? PHASE.idle!;

	return (
		<aside className="pane right">
			<div className="pane-head">
				<span className="pane-title">进度</span>
				<span className={`pill ${phase.tone}`}>{phase.text}</span>
			</div>

			<div className="pane-scroll">
				<section className="card">
					<h4>任务</h4>
					<div className="kv">
						<span>标题</span>
						<b>{task?.title ?? "—"}</b>
					</div>
					<div className="kv">
						<span>目录</span>
						<b className="mono ellipsis" title={view.cwd ?? ""}>
							{view.cwd ? view.cwd.replace(/^\/Users\/[^/]+/, "~") : "—"}
						</b>
					</div>
					<div className="kv">
						<span>模型</span>
						<b className="ellipsis">
							{model ? `${model.provider}/${model.id}` : "—"}
							{model && <em className={`tag ${imageCapable ? "ok" : ""}`}>{imageCapable ? "图片" : "文本"}</em>}
						</b>
					</div>
				</section>

				<section className="card">
					<h4>工具</h4>
					<div className="stats">
						<div>
							<b>{tools.length}</b>
							<span>调用</span>
						</div>
						<div>
							<b>{running}</b>
							<span>进行</span>
						</div>
						<div>
							<b className={failed ? "bad" : ""}>{failed}</b>
							<span>失败</span>
						</div>
					</div>
				</section>

				<section className="card">
					<h4>待审批</h4>
					{view.approvals.length === 0 ? (
						<p className="dim">无</p>
					) : (
						<ul className="list">
							{view.approvals.map((request) => (
								<li key={request.requestId} className="warn-text">
									{request.title}
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="card">
					<h4>可用模型</h4>
					{models.length === 0 ? (
						<p className="dim">开会话后加载</p>
					) : (
						<ul className="list mono small">
							{models.slice(0, 10).map((m) => (
								<li key={`${m.provider}/${m.id}`} className={m.input.includes("image") ? "ok-text" : ""}>
									{m.id}
								</li>
							))}
						</ul>
					)}
				</section>

				<p className="foot-note">对账（计划 / git / 审批）与落地区在 P2 接入。</p>
			</div>
		</aside>
	);
}
