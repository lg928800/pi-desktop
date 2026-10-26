/** 会话视图状态：把事件流折叠成可渲染的时间线。 */
import type { ApprovalRequest, ImageRef, ModelInfo, ServerEvent } from "@pi-desktop/shared";

export type TimelineItem =
	| { kind: "message"; id: string; role: "user" | "assistant"; text: string; images: ImageRef[]; streaming: boolean }
	| { kind: "tool"; id: string; toolName: string; input: unknown; output: string; status: "running" | "ok" | "error" | "blocked" };

export interface SessionView {
	sessionId: string | null;
	status: "idle" | "starting" | "running" | "crashed" | "exited";
	model: ModelInfo | null;
	cwd: string | null;
	items: TimelineItem[];
	approvals: ApprovalRequest[];
	settledAt: number | null;
}

export const emptyView: SessionView = {
	sessionId: null,
	status: "idle",
	model: null,
	cwd: null,
	items: [],
	approvals: [],
	settledAt: null,
};

export function reduceEvent(view: SessionView, event: ServerEvent): SessionView {
	switch (event.type) {
		case "session.header":
			return { ...view, sessionId: event.sessionId, model: event.model, cwd: event.cwd };

		case "session.status":
			return { ...view, status: event.status };

		case "message.delta": {
			const items = [...view.items];
			const index = items.findIndex((item) => item.kind === "message" && item.id === event.messageId);
			if (index === -1) {
				items.push({
					kind: "message",
					id: event.messageId,
					role: "assistant",
					text: event.text,
					images: [],
					streaming: true,
				});
			} else {
				const item = items[index] as Extract<TimelineItem, { kind: "message" }>;
				items[index] = { ...item, text: item.text + event.text, streaming: true };
			}
			return { ...view, items };
		}

		case "message.final": {
			const items = [...view.items];
			const index = items.findIndex((item) => item.kind === "message" && item.id === event.messageId);
			const next: TimelineItem = {
				kind: "message",
				id: event.messageId,
				role: "assistant",
				text: event.text,
				images: event.images,
				streaming: false,
			};
			if (index === -1) items.push(next);
			else items[index] = next;
			return { ...view, items };
		}

		case "tool.start":
			return {
				...view,
				items: [
					...view.items,
					{ kind: "tool", id: event.toolCallId, toolName: event.toolName, input: event.input, output: "", status: "running" },
				],
			};

		case "tool.end": {
			const items = view.items.map((item) =>
				item.kind === "tool" && item.id === event.toolCallId
					? { ...item, output: event.output, status: event.status }
					: item,
			);
			return { ...view, items };
		}

		case "approval.request":
			return { ...view, approvals: [...view.approvals, event.request] };

		case "run.settled":
			return {
				...view,
				status: "idle",
				settledAt: Date.now(),
				items: view.items.map((item) => (item.kind === "message" ? { ...item, streaming: false } : item)),
			};

		default:
			return view;
	}
}

export function resolveApproval(view: SessionView, requestId: string): SessionView {
	return { ...view, approvals: view.approvals.filter((request) => request.requestId !== requestId) };
}
