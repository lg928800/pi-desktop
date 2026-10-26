# pi-desktop 设计（v0.1）

- 依据：`requirement.md`（2026-10-26 评审版）+ P0 验证结论（`../../spike/P0-RESULTS.md`）
- 状态：待实施

## 1. 模块边界

| 模块 | 路径 | 只做一件事 | 禁止 |
| --- | --- | --- | --- |
| `shared` | `src/shared` | WS 消息与领域类型的唯一定义 | 不含运行时逻辑、不 import node |
| `bridge` | `src/bridge` | 会话池、RPC 帧解析、任务元数据、git、对账 | 不碰 DOM、不直接生成 UI 文案以外的渲染 |
| `ui` | `src/ui` | 三栏界面与交互 | 不直接 spawn 进程、不读 session 文件 |
| `ext-permission` | `extensions/permission` | `tool_call` 网关：四档策略 + 受保护路径 + 审批 | 不持久化自己的状态（状态交给 bridge） |
| `ext-plan` | `extensions/plan` | 计划步骤与 `[DONE:n]` 标记，写入 tool result details | 不做渲染 |
| `shell` | `src-tauri` | 窗口、托盘、全局快捷键、通知、IPC 转发 | 不含业务逻辑 |

依赖方向单向：`shell → ui → shared ← bridge ←（子进程）pi`。`bridge` 与 `ui` 之间只有 WS，没有共享内存。

## 2. 进程模型

- **Bridge 常驻**，生命周期比窗口长：关窗不杀 agent。
- **一个会话 = 一个 `pi --mode rpc` 子进程**，`cwd` 固定为任务的 project root。
- 子进程异常退出 → 该会话标记 `crashed`，其他会话不受影响；重连后 `get_messages` 恢复现场。
- 审批超时/UI 断线 → 子进程**保持阻塞**（fail-closed），不自动放行；bridge 记一条 `approval_unanswered` 审计。

## 3. WS 协议

客户端 → 服务端（请求/响应，`id` 关联）：

```jsonc
{ "id": "r1", "op": "project.list" }
{ "id": "r2", "op": "tree.get", "projectId": "p1" }
{ "id": "r3", "op": "task.create", "featureId": "f1", "title": "...", "attachments": [{ "path": "/abs/a.ts", "mode": "working" }] }
{ "id": "r4", "op": "session.start", "taskId": "t1", "model": "zai-lan/glm-5.3-flash" }
{ "id": "r5", "op": "prompt.send", "sessionId": "s1", "message": "...", "images": [{ "type": "image", "data": "<base64>", "mimeType": "image/png" }] }
{ "id": "r6", "op": "run.abort", "sessionId": "s1" }
{ "id": "r7", "op": "approval.reply", "requestId": "a1", "confirmed": true }
{ "id": "r8", "op": "model.list" }
{ "id": "r9", "op": "git.diff", "taskId": "t1" }
{ "id": "r10", "op": "git.commit", "taskId": "t1", "message": "..." }
```

服务端 → 客户端（事件，无 `id`）：

```jsonc
{ "type": "session.header", "sessionId": "s1", "cwd": "/abs", "model": {...} }
{ "type": "message.delta", "sessionId": "s1", "messageId": "m1", "text": "..." }
{ "type": "message.final", "sessionId": "s1", "message": {...} }        // 权威，替换 delta 拼出的内容
{ "type": "tool.start", "sessionId": "s1", "toolCallId": "c1", "toolName": "edit", "input": {...} }
{ "type": "tool.end", "sessionId": "s1", "toolCallId": "c1", "status": "ok", "result": "..." }
{ "type": "approval.request", "requestId": "a1", "sessionId": "s1", "kind": "confirm", "title": "...", "detail": "...", "timeoutMs": 60000 }
{ "type": "progress.update", "taskId": "t1", "steps": [...], "phase": "executing" }
{ "type": "reconcile", "taskId": "t1", "findings": [{ "level": "warn", "code": "OUT_OF_SCOPE", "path": "..." }] }
{ "type": "run.settled", "sessionId": "s1" }
{ "type": "error", "scope": "session", "sessionId": "s1", "message": "..." }
```

规则：
- **`message.final` 永远覆盖 `message.delta` 的拼接结果**，前端不做"哪个对"的判断。
- 结束信号只认 `run.settled`（来自 pi 的 `agent_settled`）。
- 事件里不带 base64 大图；图片在 `message.final` 里以 `imageRef` 表示，原图另走 `op: "asset.get"`，避免 WS 单帧膨胀。

## 4. 任务元数据

存放：`~/.pi-desktop/state.json`（跨平台一致，避开 Tauri 各自的 appData 差异；后续可迁）。

```jsonc
{
  "version": 1,
  "projects": [{
    "id": "p1", "name": "pi-desktop", "root": "/Users/x/onlyProject/pi-desktop",
    "defaults": { "model": "zai-lan/glm-5.3-flash", "thinkingLevel": "medium", "permission": "L2" }
  }],
  "features": [{ "id": "f1", "projectId": "p1", "name": "登录重构", "acceptance": "..." }],
  "tasks": [{
    "id": "t1", "featureId": "f1", "title": "拆出 AuthService", "status": "executing",
    "branch": "feat/auth", "worktree": null,
    "permission": "L2", "milestone": "v0.2",
    "attachments": [{ "path": "/abs/a.ts", "mode": "working" }],
    "acceptance": "现有测试通过"
  }],
  "sessions": [{ "id": "s1", "taskId": "t1", "label": "尝试 A", "sessionFile": "/Users/x/.pi/agent/sessions/...jsonl", "status": "idle" }]
}
```

- `mode`: `context`（只读上下文）/ `working`（可改）/ `protected`（禁止触碰）。
- 会话内容**不入库**，只存 `sessionFile` 指针；`sessionFile` 为 null 时表示未持久化会话。
- 写入用「读-改-写 + 原子替换（tmp + rename）」，避免崩溃写坏。

## 5. 三轨对账

| 编号 | 检查 | 数据源 | 级别 |
| --- | --- | --- | --- |
| R1 | 计划里声明的文件 ≠ git 实际改动 | `[DONE]` 步骤 + `git status` | warn |
| R2 | 改动了 `protected` 附件 | `git diff --name-only` × attachments | error |
| R3 | 出现未经审批的破坏性动作 | gate 审计日志 vs 动作记录 | error（视为 bug） |
| R4 | 会话 cwd ≠ 任务所属 project.root | `session.header.cwd` | error |
| R5 | 改动落到任务声明范围外（`working` 之外） | `git status` × attachments | warn |

对账时机：每个 `run.settled` 后自动跑一次，落地区打开时再跑一次。

## 6. 权限策略

策略对象（项目默认 → 功能集 → 任务，后者覆盖前者）：

```jsonc
{
  "level": "L2",
  "overrides": [
    { "match": { "tool": "bash", "dangerous": true }, "action": "ask" },
    { "match": { "tool": "write" }, "pathOutside": "working", "action": "ask" }
  ],
  "commitGate": "manual"
}
```

档位到 pi 的实际映射：

| 档位 | 工具集 | 网关行为 | 落地 |
| --- | --- | --- | --- |
| L0 | `read` + `bash`（白名单） | 白名单外一律 block | 手动 |
| L1 | 全部 | 破坏性/写入/联网 → ask | 手动 |
| L2（默认） | 全部 | 破坏性（含删文件、越界写）→ ask；其余放行 | 手动 |
| L3 | 全部 | 只记录不拦 | 自动 commit，UI 常驻标识 |

`dangerous` 的判定：优先用 pi 的 `annotations.destructiveHint`，其次内置正则（`rm`/`sudo`/`chmod 777`/`git push`/`curl`）。

## 7. 多模态管线

```
粘贴/拖拽/选文件
  → ui 读取 ArrayBuffer（限 8MB，超限先降采样）
  → WS 二进制或 base64（单帧 ≤ 6MB，超出走分片）
  → bridge 校验 mimeType ∈ {png,jpeg,webp,gif}
  → pi `prompt.images`
```

- 模型能力来自 `get_available_models` 的 `input` 数组；不支持图片的模型禁用附件入口。
- 裁剪/缩放交给 pi（`images.resize` 是缓存安全的），bridge 只做体积兜底。

## 8. 跨平台实现约束

见 `requirement.md` §12。补充两条代码级约束：
- 所有 `spawn` 走 `platform.spawnAgent()`，Windows 分支补 `shell: true` 与 `.cmd` 解析。
- 所有快捷键注册走 `platform.keymap`，源码里**不出现** `metaKey` 字面量。

## 9. P1 垂直切片（最小可用）

目标：在 `pi-desktop` 仓库上跑通「建项目 → 建任务 → 开会话 → 对话 → 看工具卡片 → 中断」，全程不切终端。

不做：右侧对账面板、权限四档、多会话并行、托盘（P2/P3/P4）。
