import { useEffect, useMemo, useRef, useState } from "react";
import type { ApprovalRequest, ClientOp, ModelInfo, Task, TreeSnapshot } from "@pi-desktop/shared";
import { BridgeClient, resolveEndpoint, type BridgeEndpoint } from "./lib/bridge-client.ts";
import { emptyView, reduceEvent, resolveApproval, type SessionView } from "./lib/session-view.ts";
import { Tree } from "./components/Tree.tsx";
import { Chat } from "./components/Chat.tsx";
import { ProgressPanel } from "./components/ProgressPanel.tsx";
import { ApprovalDialog } from "./components/ApprovalDialog.tsx";
import { ConnectBar } from "./components/ConnectBar.tsx";
import { CreateDialog, type CreateRequest } from "./components/CreateDialog.tsx";
import { TitleBar } from "./components/TitleBar.tsx";

const RIGHT_KEY = "pi-desktop.right-panel";

export default function App() {
	const [tree, setTree] = useState<TreeSnapshot>({ projects: [] });
	const [view, setView] = useState<SessionView>(emptyView);
	const [models, setModels] = useState<ModelInfo[]>([]);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [connection, setConnection] = useState<"connecting" | "open" | "closed" | "idle">("idle");
	const [error, setError] = useState<string | null>(null);
	const [rightOpen, setRightOpen] = useState(() => localStorage.getItem(RIGHT_KEY) !== "closed");
	const [connecting, setConnecting] = useState(false);
	const [create, setCreate] = useState<CreateRequest | null>(null);
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

	useEffect(() => {
		localStorage.setItem(RIGHT_KEY, rightOpen ? "open" : "closed");
	}, [rightOpen]);

	const connect = (endpoint: BridgeEndpoint) => {
		clientRef.current?.close();
		setConnecting(true);
		const client = new BridgeClient(endpoint);
		clientRef.current = client;
		client.onStatus = (status) => {
			setConnection(status);
			if (status !== "connecting") setConnecting(false);
		};
		client.onEvent((event) => {
			setView((current) => {
				// 多会话并存时，广播事件必须按 sessionId 过滤，否则会串台
				const eventSession = "sessionId" in event ? (event as { sessionId?: string }).sessionId : undefined;
				if (eventSession && current.sessionId && eventSession !== current.sessionId) return current;
				return reduceEvent(current, event);
			});
		});
		client.connect();
	};

	useEffect(() => {
		const endpoint = resolveEndpoint();
		if (endpoint) connect(endpoint);

		const onReady = () => {
			const injected = resolveEndpoint();
			if (injected) connect(injected);
		};
		window.addEventListener("pi-desktop-ready", onReady);
		return () => {
			window.removeEventListener("pi-desktop-ready", onReady);
			clientRef.current?.close();
		};
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

	async function submitCreate(values: { name: string; root?: string }) {
		if (!create) return;
		if (create.kind === "project") {
			await call({ op: "project.create", name: values.name, root: values.root ?? values.name });
		} else if (create.kind === "feature") {
			await call({ op: "feature.create", projectId: create.parentId!, name: values.name });
		} else {
			await call({ op: "task.create", featureId: create.parentId!, title: values.name });
		}
		await refreshTree();
		setCreate(null);
	}

	async function startSession(task: Task) {
		setSelectedTask(task);
		setView(emptyView);
		try {
			const result = await call<{
				sessionId: string;
				models: ModelInfo[];
				history?: Array<{ role: "user" | "assistant"; text: string }>;
			}>({ op: "session.start", taskId: task.id });
			setModels(result.models);
			setView((current) => ({
				...current,
				sessionId: result.sessionId,
				items: (result.history ?? []).map((message, index) => ({
					kind: "message" as const,
					id: `h${index}`,
					role: message.role,
					text: message.text,
					images: [],
					streaming: false,
				})),
			}));
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
		<div className={`app ${rightOpen ? "" : "collapsed-right"}`}>
			<TitleBar
				taskTitle={selectedTask?.title ?? null}
				status={view.status}
				rightOpen={rightOpen}
				onToggleRight={() => setRightOpen((open) => !open)}
			/>

			<div className="body">
				<Tree
					tree={tree}
					connected={connection === "open"}
					selectedTaskId={selectedTask?.id ?? null}
					onCreateProject={() => setCreate({ kind: "project" })}
					onCreateFeature={(projectId, name) => setCreate({ kind: "feature", parentId: projectId, parentName: name })}
					onCreateTask={(featureId, name) => setCreate({ kind: "task", parentId: featureId, parentName: name })}
					onSelectTask={startSession}
				/>

				<main className="center">
					{connection !== "open" && (
						<ConnectBar connecting={connecting} connection={connection} onConnect={connect} />
					)}

					{error && (
						<button className="error" onClick={() => setError(null)}>
							{error}
							<span className="dismiss">点击关闭</span>
						</button>
					)}

					<Chat view={view} task={selectedTask} onSend={send} onAbort={abort} />
				</main>

				{rightOpen && <ProgressPanel view={view} task={selectedTask} models={models} />}
			</div>

			{pending && <ApprovalDialog request={pending} onDecide={(ok) => void replyApproval(pending, ok)} />}
			{create && <CreateDialog request={create} onCancel={() => setCreate(null)} onSubmit={submitCreate} />}
		</div>
	);
}
