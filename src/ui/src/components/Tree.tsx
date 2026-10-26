import type { Task, TreeSnapshot } from "@pi-desktop/shared";

interface Props {
	tree: TreeSnapshot;
	connected: boolean;
	selectedTaskId: string | null;
	onCreateProject: () => void;
	onCreateFeature: (projectId: string, projectName: string) => void;
	onCreateTask: (featureId: string, featureName: string) => void;
	onSelectTask: (task: Task) => void;
}

const STATUS_DOT: Record<string, { glyph: string; tone: string }> = {
	draft: { glyph: "○", tone: "muted" },
	planning: { glyph: "◔", tone: "warn" },
	executing: { glyph: "●", tone: "ok" },
	waiting_approval: { glyph: "◐", tone: "warn" },
	ready_to_land: { glyph: "◑", tone: "accent" },
	done: { glyph: "✓", tone: "muted" },
	failed: { glyph: "✕", tone: "bad" },
};

export function Tree({
	tree,
	connected,
	selectedTaskId,
	onCreateProject,
	onCreateFeature,
	onCreateTask,
	onSelectTask,
}: Props) {
	const total = tree.projects.length;

	return (
		<aside className="pane left">
			<div className="pane-head">
				<span className="pane-title">项目</span>
				<span className="pane-count">{total || ""}</span>
				<button className="icon-btn" onClick={onCreateProject} title="新建项目" disabled={!connected}>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
						<path d="M8 3v10M3 8h10" />
					</svg>
				</button>
			</div>

			<div className="pane-scroll tree">
				{total === 0 && (
					<div className="empty small">
						<p>还没有项目</p>
						<p className="dim">点右上 ＋ 添加一个本地目录</p>
					</div>
				)}

				{tree.projects.map(({ project, features }) => (
					<section key={project.id} className="group">
						<div className="group-head" title={project.root}>
							<span className="group-name">{project.name}</span>
							<button
								className="ghost-btn"
								onClick={() => onCreateFeature(project.id, project.name)}
								title="新建功能集"
								disabled={!connected}
							>
								＋
							</button>
						</div>
						<div className="group-path">{project.root.replace(/^\/Users\/[^/]+/, "~")}</div>

						{features.length === 0 && <p className="group-hint">暂无功能集</p>}

						{features.map(({ feature, tasks }) => (
							<div key={feature.id} className="feature">
								<div className="feature-head">
									<span className="feature-name">{feature.name}</span>
									<button
										className="ghost-btn"
										onClick={() => onCreateTask(feature.id, feature.name)}
										title="新建任务"
										disabled={!connected}
									>
										＋
									</button>
								</div>

								{tasks.map((task) => {
									const tone = STATUS_DOT[task.status] ?? STATUS_DOT.draft;
									return (
										<button
											key={task.id}
											className={`task ${task.id === selectedTaskId ? "active" : ""}`}
											onClick={() => onSelectTask(task)}
											title={task.title}
										>
											<span className={`dot ${tone!.tone}`}>{tone!.glyph}</span>
											<span className="task-name">{task.title}</span>
										</button>
									);
								})}
							</div>
						))}
					</section>
				))}
			</div>
		</aside>
	);
}
