/**
 * op 路由（design.md §3）：把 WS 请求翻译成状态变更 / 会话动作。
 * 不含传输细节，便于单测。
 */
import type { ClientOp, Project, ServerEvent, Task, TreeSnapshot } from "@pi-desktop/shared";
import type { SessionManager } from "./session-manager.ts";
import type { StateStore } from "./state-store.ts";

export interface BridgeDeps {
	state: StateStore;
	sessions: SessionManager;
	emit: (event: ServerEvent) => void;
	newId: (prefix: string) => string;
}

export class Bridge {
	constructor(private readonly deps: BridgeDeps) {}

	async handle(op: ClientOp): Promise<unknown> {
		switch (op.op) {
			case "project.list":
				return (await this.deps.state.load()).projects;

			case "project.create": {
				const project: Project = {
					id: this.deps.newId("p"),
					name: op.name,
					root: op.root,
					defaults: { permission: op.permission ?? "L2" },
				};
				await this.deps.state.update((s) => {
					s.projects.push(project);
				});
				return project;
			}

			case "feature.create": {
				const state = await this.deps.state.load();
				if (!state.projects.some((p) => p.id === op.projectId)) throw new Error(`no such project: ${op.projectId}`);
				const feature = { id: this.deps.newId("f"), projectId: op.projectId, name: op.name };
				await this.deps.state.update((s) => {
					s.features.push(feature);
				});
				return feature;
			}

			case "task.create": {
				const state = await this.deps.state.load();
				const feature = state.features.find((f) => f.id === op.featureId);
				if (!feature) throw new Error(`no such feature: ${op.featureId}`);
				const project = state.projects.find((p) => p.id === feature.projectId);
				const task: Task = {
					id: this.deps.newId("t"),
					featureId: op.featureId,
					title: op.title,
					status: "draft",
					attachments: op.attachments ?? [],
					permission: project?.defaults.permission,
				};
				await this.deps.state.update((s) => {
					s.tasks.push(task);
				});
				return task;
			}

			case "task.setStatus": {
				let updated: Task | undefined;
				await this.deps.state.update((s) => {
					updated = s.tasks.find((t) => t.id === op.taskId);
					if (updated) updated.status = op.status;
				});
				if (!updated) throw new Error(`no such task: ${op.taskId}`);
				return updated;
			}

			case "tree.get": {
				const state = await this.deps.state.load();
				const snapshot: TreeSnapshot = {
					projects: state.projects
						.filter((project) => !op.projectId || project.id === op.projectId)
						.map((project) => ({
							project,
							features: state.features
								.filter((f) => f.projectId === project.id)
								.map((feature) => ({
									feature,
									tasks: state.tasks.filter((t) => t.featureId === feature.id),
								})),
						})),
				};
				return snapshot;
			}

			case "session.start": {
				const state = await this.deps.state.load();
				const task = state.tasks.find((t) => t.id === op.taskId);
				if (!task) throw new Error(`no such task: ${op.taskId}`);
				const feature = state.features.find((f) => f.id === task.featureId);
				const project = state.projects.find((p) => p.id === feature?.projectId);
				if (!project) throw new Error(`task ${task.id} has no project`);

				const sessionId = this.deps.newId("s");
				const result = await this.deps.sessions.start({
					sessionId,
					taskId: task.id,
					cwd: project.root,
					model: op.model ?? project.defaults.model,
				});

				await this.deps.state.update((s) => {
					s.sessions.push({ id: sessionId, taskId: task.id, label: `会话 ${s.sessions.length + 1}`, sessionFile: null, status: "idle" });
					const t = s.tasks.find((x) => x.id === task.id);
					if (t && t.status === "draft") t.status = "executing";
				});
				this.deps.emit({ type: "state.changed" });
				return { sessionId, models: result.models };
			}

			case "session.list": {
				const state = await this.deps.state.load();
				return state.sessions.filter((s) => s.taskId === op.taskId);
			}

			case "prompt.send":
				await this.deps.sessions.prompt(op.sessionId, op.message, op.images);
				return { ok: true };

			case "run.abort":
				await this.deps.sessions.abort(op.sessionId);
				return { ok: true };

			case "approval.reply":
				this.deps.sessions.reply(op.requestId, op.confirmed);
				return { ok: true };

			case "model.list":
				return this.deps.sessions.models(op.sessionId);

			case "asset.get": {
				const asset = this.deps.sessions.asset(op.sessionId, op.ref);
				if (!asset) throw new Error(`no such asset: ${op.ref}`);
				return asset;
			}

			default: {
				const unknown = op as { op: string };
				throw new Error(`unknown op: ${unknown.op}`);
			}
		}
	}
}
