import { useEffect, useMemo, useRef, useState } from "react";
import type { ApprovalRequest, ClientOp, ModelInfo, Task, TreeSnapshot } from "@pi-desktop/shared";
import { BridgeClient, resolveEndpoint } from "./lib/bridge-client.ts";
import { emptyView, reduceEvent, resolveApproval, type SessionView } from "./lib/session-view.ts";
import { Tree } from "./components/Tree.tsx";
import { Chat } from "./components/Chat.tsx";
import { ProgressPanel } from "./components/ProgressPanel.tsx";
import { ApprovalDialog } from "./components/ApprovalDialog.tsx";
import { ConnectBar } from "./components/ConnectBar.tsx";

export default function App() {
	const [tree, setTree] = useState<TreeSnapshot>({ projects: [] });
	const [view, setView] = useState<SessionView>(emptyView);
	const [models, setModels] = useState<ModelInfo[]>([]);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [connection, setConnection] = useState<"connecting" | "open" | "closed" | "idle">("idle");
	const [error, setError] = useState<string | null>(null);
	const clientRef = useRef<BridgeClient | null>(null);
	const viewRef = useRef(view);
	viewRef.current = view;

	const call = useMemo(
		() =>
			async <T,>(op: Omit<ClientOp, "id">, client = clientRef.current): Promise<T> => {
				if (!client) throw new Error("bridge 未连接");
				return client.call<T>(op);
			},
		[],
	);

	const connect = (endpoint: ReturnType<typeof resolveEndpoint>) => {
		if (!endpoint) return;
		clientRef.current?.close();
		const client = new BridgeClient(endpoint);
		clientRef.current = client;
		client.onStatus = setConnection;
		client.onEvent((event) => {
			if (event.type === "approval.request") {
				// 审批必须由人应答；这里只入队，不自动放行（fail-closed）
				setView((current) => reduceEvent(current, event));
				return;
			}
			setView((current) => reduceEvent(current, event));
		});
		client.connect();
	};

	useEffect(() => {
		const endpoint = resolveEndpoint();
		if (endpoint) connect(endpoint);
		return () => clientRef.current?.close();
	}, []);

	useEffect(() => {
		if (connection !== "open") return;
		void refreshTree();
	}, [connection]);

	async function refreshTree() {
		try {
			const snapshot = await call<TreeSnapshot>({ op: "tree.get", projectId: "" });
			setTree(snapshot);
		} catch (e) {
			setError((e as Error).message);
		}
	}

	async function createProject() {
		const root = window.prompt("项目根目录（绝对路径）");
		if (!root) return;
		const name = window.prompt("项目名", root.split("/").filter(Boolean).at(-1) ?? "project");
		if (!name) return;
		await call({ op: "project.create", name, root });
		await refreshTree();
	}

	async function createFeature(projectId: string) {
		const name = window.prompt("功能集名称");
		if (!name) return;
		await call({ op: "feature.create", projectId, name });
		await refreshTree();
	}

	async function createTask(featureId: string) {
		const title = window.prompt("任务标题");
		if (!title) return;
		await call({ op: "task.create", featureId, title });
		await refreshTree();
	}

	async function startSession(task: Task) {
		setSelectedTask(task);
		setView(emptyView);
		try {
			const result = await call<{ sessionId: string; models: ModelInfo[] }>({ op: "session.start", taskId: task.id });
			setModels(result.models);
			setView((current) => ({ ...current, sessionId: result.sessionId }));
		} catch (e) {
			setError((e as Error).message);
		}
	}

	async function send(message: string, images: Array<{ type: "image"; data: string; mimeType: string }>) {
		const sessionId = viewRef.current.sessionId;
		if (!sessionId) {
			setError("先选一个任务并开会话");
			return;
		}
		setView((current) => ({
			...current,
			items: [
				...current.items,
				{ kind: "message", id: `u${Date.now()}`, role: "user", text: message, images: [], streaming: false },
			],
		}));
		await call({ op: "prompt.send", sessionId, message, images: images.length ? images : undefined });
	}

	async function abort() {
		const sessionId = viewRef.current.sessionId;
		if (sessionId) await call({ op: "run.abort", sessionId });
	}

	async function replyApproval(request: ApprovalRequest, confirmed: boolean) {
		setView((current) => resolveApproval(current, request.requestId));
		await call({ op: "approval.reply", requestId: request.requestId, confirmed });
	}

	const pending = view.approvals[0];

	return (
		<div className="app">
			<Tree
				tree={tree}
				selectedTaskId={selectedTask?.id ?? null}
				onCreateProject={createProject}
				onCreateFeature={createFeature}
				onCreateTask={createTask}
				onSelectTask={startSession}
			/>

			<main className="center">
				{connection !== "open" && <ConnectBar connection={connection} onConnect={connect} />}
				{error && (
					<div className="error" onClick={() => setError(null)}>
						{error}
					</div>
				)}
				<Chat view={view} onSend={send} onAbort={abort} />
			</main>

			<ProgressPanel view={view} task={selectedTask} models={models} />
			{pending && <ApprovalDialog request={pending} onDecide={(ok) => void replyApproval(pending, ok)} />}
		</div>
	);
}
