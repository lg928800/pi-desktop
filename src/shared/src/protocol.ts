/**
 * WS 协议：客户端 op / 服务端 event 的唯一定义（design.md §3）。
 * 只放类型，不放运行时逻辑。
 */
import type {
	ImagePayload,
	ImageRef,
	ModelInfo,
	PermissionLevel,
	Session,
	SessionStatus,
	Task,
	TaskStatus,
} from "./domain.ts";

export interface ClientRequest {
	id: string;
	op: string;
}

export type ClientOp =
	| { id: string; op: "project.list" }
	| { id: string; op: "tree.get"; projectId: string }
	| { id: string; op: "project.create"; name: string; root: string; permission?: PermissionLevel }
	| { id: string; op: "feature.create"; projectId: string; name: string }
	| { id: string; op: "task.create"; featureId: string; title: string; attachments?: Task["attachments"] }
	| { id: string; op: "task.setStatus"; taskId: string; status: TaskStatus }
	| { id: string; op: "session.start"; taskId: string; model?: string }
	| { id: string; op: "session.resume"; sessionId: string }
	| { id: string; op: "session.list"; taskId: string }
	| {
			id: string;
			op: "prompt.send";
			sessionId: string;
			message: string;
			images?: ImagePayload[];
			streamingBehavior?: "steer" | "followUp";
	  }
	| { id: string; op: "run.abort"; sessionId: string }
	| { id: string; op: "approval.reply"; requestId: string; confirmed: boolean }
	| { id: string; op: "model.list" }
	| { id: string; op: "asset.get"; ref: string };

/** 应答：成功带 data，失败带 error；id 与请求一致 */
export type ClientResponse =
	| { id: string; ok: true; data?: unknown }
	| { id: string; ok: false; error: string };

export interface TreeSnapshot {
	projects: Array<{
		project: import("./domain.ts").Project;
		features: Array<{ feature: import("./domain.ts").Feature; tasks: Task[] }>;
	}>;
}

export interface ProgressStep {
	id: number;
	text: string;
	done: boolean;
}

export interface ReconcileFinding {
	level: "info" | "warn" | "error";
	/** R1..R5，见 design.md §5 */
	code: "OUT_OF_SCOPE" | "PROTECTED_TOUCHED" | "UNAPPROVED_ACTION" | "CWD_MISMATCH" | "PLAN_MISMATCH";
	detail: string;
	path?: string;
}

export interface ApprovalRequest {
	requestId: string;
	sessionId: string;
	kind: "confirm" | "select" | "input" | "editor";
	title: string;
	detail?: string;
	options?: string[];
	timeoutMs?: number;
}

export type ServerEvent =
	| { type: "session.header"; sessionId: string; cwd: string; model: ModelInfo | null }
	| { type: "session.status"; sessionId: string; status: SessionStatus }
	| { type: "message.delta"; sessionId: string; messageId: string; text: string }
	| { type: "message.final"; sessionId: string; messageId: string; text: string; images: ImageRef[] }
	| {
			type: "tool.start";
			sessionId: string;
			toolCallId: string;
			toolName: string;
			input: unknown;
	  }
	| {
			type: "tool.end";
			sessionId: string;
			toolCallId: string;
			status: "ok" | "error" | "blocked";
			output: string;
	  }
	| { type: "approval.request"; request: ApprovalRequest }
	| { type: "progress.update"; taskId: string; phase: TaskStatus; steps: ProgressStep[] }
	| { type: "reconcile"; taskId: string; findings: ReconcileFinding[] }
	| { type: "run.settled"; sessionId: string }
	| { type: "state.changed"; session?: Session }
	| { type: "error"; scope: "bridge" | "session" | "protocol"; sessionId?: string; message: string };

/** 编译期穷尽性检查：新增 ServerEvent 分支却漏处理时会报错 */
export function assertNever(value: never): never {
	throw new Error(`unhandled event: ${JSON.stringify(value)}`);
}
