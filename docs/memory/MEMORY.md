# pi-desktop 记忆索引（≤200 行）

> 分区：project=本项目决策/事实；reference=外部资源位置。详情写 `docs/memory/<主题>.md`，这里只留指针。

## project

- 2026-10-26 | 定位 = pi 的可视化桌面端；架构红线 = 不改 pi 源码，`pi --mode rpc` 当引擎（详见根 AGENTS.md）
- 2026-10-26 | 已定：独立仓库位置 `~/onlyProject/pi-desktop`，不并入 rea（避免污染 rea 的需求索引与模块注册表）
- 2026-10-26 | 已定：外壳用 Tauri 2（要独立窗口/托盘/全局快捷键，不要依赖浏览器）
- 2026-10-26 | 已定：核心心智 = 会话中心 + 左侧四级层级树（项目/功能集/任务/会话）+ 右侧进度与落地面板
- 2026-10-26 | 已定：权限四档（L0 只读 / L1 危险审批 / L2 自动+落地前审批 / L3 全自动），默认 L1；「干活审批」与「落地审批」是两回事
- 2026-10-26 | 用途 = 个人开发者日常 agent（非垂直场景）；层级定四级，时间盒降级为 task.milestone 标签；默认权限 L2（破坏性动作+落地前仍审批）
- 2026-10-26 | P0 已验证：RPC 字节切帧 / 流式 / images 多模态 / tool_call 审批链路 全通过（spike/P0-RESULTS.md）

- 2026-10-26 | P1 已跑通：Tauri 窗口 + bridge（WS 127.0.0.1 + token）+ UI 三栏；`npm run e2e` 用真 pi 通过
- 2026-10-26 | 权限网关（L0–L3）尚未实现，现在是裸工具执行；落地/对账在 P2/P3

## reference

- pi 安装目录：`/Users/Zhuanz/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent`（升级后版本号会变）
- pi RPC 示例代码：同目录 `examples/rpc-client.ts`、`examples/rpc-extension-ui.ts`
- pi HTML 导出模板（可复用渲染参考）：`dist/core/export-html/`
- pi 官方扩展示例（逻辑可复用，渲染需重写）：`examples/extensions/permission-gate.ts`、`plan-mode/`、`todo.ts`、`protected-paths.ts`、`git-checkpoint.ts`
- pi 状态钩子：`pi.on("tool_call")` 返回 `{ block: true, reason }` 可拦截工具；`ctx.ui.confirm` 在 RPC 模式转成 `extension_ui_request`
