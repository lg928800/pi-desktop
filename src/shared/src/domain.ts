/** 领域模型：层级树与权限策略。持久化契约见 docs/.../design.md §4。 */

export type PermissionLevel = "L0" | "L1" | "L2" | "L3";

export type AttachmentMode = "context" | "working" | "protected";

export type TaskStatus =
	| "draft"
	| "planning"
	| "executing"
	| "waiting_approval"
	| "ready_to_land"
	| "done"
	| "failed";

export type SessionStatus = "starting" | "idle" | "running" | "crashed" | "exited";

export interface Attachment {
	/** 绝对路径；bridge 负责规范化，UI 只展示 */
	path: string;
	mode: AttachmentMode;
}

export interface ProjectDefaults {
	model?: string;
	thinkingLevel?: string;
	permission: PermissionLevel;
}

export interface Project {
	id: string;
	name: string;
	root: string;
	defaults: ProjectDefaults;
}

export interface Feature {
	id: string;
	projectId: string;
	name: string;
	acceptance?: string;
}

export interface Task {
	id: string;
	featureId: string;
	title: string;
	status: TaskStatus;
	branch?: string;
	worktree?: string;
	/** 未设置时继承 feature → project 的默认档位 */
	permission?: PermissionLevel;
	milestone?: string;
	attachments: Attachment[];
	acceptance?: string;
}

export interface Session {
	id: string;
	taskId: string;
	label: string;
	/** pi 持久化会话文件路径；null 表示未持久化 */
	sessionFile: string | null;
	status: SessionStatus;
}

export interface StateFile {
	version: 1;
	projects: Project[];
	features: Feature[];
	tasks: Task[];
	sessions: Session[];
}

export interface ModelInfo {
	provider: string;
	id: string;
	name?: string;
	/** 只要不含 "image"，就不允许挂图片 */
	input: Array<"text" | "image">;
}

export interface ImagePayload {
	type: "image";
	/** base64，不含 data: 前缀 */
	data: string;
	mimeType: string;
}

/** 图片引用：事件里只传引用，原图另走 asset.get，避免 WS 单帧膨胀 */
export interface ImageRef {
	type: "image";
	ref: string;
	mimeType: string;
	width?: number;
	height?: number;
}
