import type { ModelInfo, Task } from "@pi-desktop/shared";
import type { SessionView } from "../lib/session-view.ts";

interface Props {
	view: SessionView;
	task: Task | null;
	models: ModelInfo[];
}

const PHASE_LABEL: Record<string, string> = {
	idle: "空闲",
	starting: "启动中",
	running: "执行中",
	crashed: "已崩溃",
	exited: "已退出",
};

export function ProgressPanel({ view, task, models }: Props) {
	const toolItems = view.items.filter((item) => item.kind === "tool");
	const running = toolItems.filter((item) => item.status === "running").length;
	const failed = toolItems.filter((item) => item.status === "error").length;
	const model = view.model;
	const imageCapable = model?.input?.includes("image") ?? false;

	return (
		<aside className="right">
			<h3>进度</h3>

			<dl className="facts">
				<dt>阶段</dt>
				<dd>{PHASE_LABEL[view.status] ?? view.status}</dd>
				<dt>任务</dt>
				<dd>{task?.title ?? "—"}</dd>
				<dt>工作目录</dt>
				<dd className="mono small">{view.cwd ?? "—"}</dd>
				<dt>模型</dt>
				<dd>
					{model ? `${model.provider}/${model.id}` : "—"}
					{model && <span className={`tag ${imageCapable ? "ok" : ""}`}>{imageCapable ? "支持图片" : "纯文本"}</span>}
				</dd>
			</dl>

			<h3>工具</h3>
			<ul className="counters">
				<li>
					调用 <b>{toolItems.length}</b>
				</li>
				<li>
					进行中 <b>{running}</b>
				</li>
				<li>
					失败 <b className={failed ? "bad" : ""}>{failed}</b>
				</li>
			</ul>

			<h3>待审批</h3>
			{view.approvals.length === 0 ? (
				<p className="hint">无</p>
			) : (
				<ul className="approvals">
					{view.approvals.map((request) => (
						<li key={request.requestId}>{request.title}</li>
					))}
				</ul>
			)}

			<h3>可用模型</h3>
			{models.length === 0 ? (
				<p className="hint">开会话后加载</p>
			) : (
				<ul className="models">
					{models.slice(0, 12).map((m) => (
						<li key={`${m.provider}/${m.id}`} className={m.input.includes("image") ? "image-capable" : ""}>
							{m.provider}/{m.id}
						</li>
					))}
				</ul>
			)}

			<p className="note">对账（计划 / git / 审批三轨）在 P2 接入，这里先留位。</p>
		</aside>
	);
}
