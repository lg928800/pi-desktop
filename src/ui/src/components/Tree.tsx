import type { Task, TreeSnapshot } from "@pi-desktop/shared";

interface Props {
	tree: TreeSnapshot;
	selectedTaskId: string | null;
	onCreateProject: () => void;
	onCreateFeature: (projectId: string) => void;
	onCreateTask: (featureId: string) => void;
	onSelectTask: (task: Task) => void;
}

const STATUS_DOT: Record<string, string> = {
	draft: "○",
	planning: "◔",
	executing: "●",
	waiting_approval: "◐",
	ready_to_land: "◑",
	done: "✓",
	failed: "✕",
};

export function Tree({ tree, selectedTaskId, onCreateProject, onCreateFeature, onCreateTask, onSelectTask }: Props) {
	return (
		<aside className="left">
			<header className="left-head">
				<span>项目</span>
				<button onClick={onCreateProject} title="新建项目">＋</button>
			</header>

			<div className="tree">
				{tree.projects.length === 0 && <p className="hint">还没有项目。点 ＋ 添加一个本地目录。</p>}
				{tree.projects.map(({ project, features }) => (
					<section key={project.id} className="project">
						<div className="row project-row" title={project.root}>
							<span className="caret">▾</span>
							<span className="name">{project.name}</span>
							<button className="mini" onClick={() => onCreateFeature(project.id)} title="新建功能集">＋</button>
						</div>
						<div className="root">{project.root}</div>

						{features.map(({ feature, tasks }) => (
							<div key={feature.id} className="feature">
								<div className="row feature-row">
									<span className="caret">▾</span>
									<span className="name">{feature.name}</span>
									<button className="mini" onClick={() => onCreateTask(feature.id)} title="新建任务">＋</button>
								</div>
								{tasks.map((task) => (
									<button
										key={task.id}
										className={`row task-row ${task.id === selectedTaskId ? "active" : ""}`}
										onClick={() => onSelectTask(task)}
										title={task.acceptance ?? task.title}
									>
										<span className="dot">{STATUS_DOT[task.status] ?? "○"}</span>
										<span className="name">{task.title}</span>
									</button>
								))}
							</div>
						))}
					</section>
				))}
			</div>
		</aside>
	);
}
