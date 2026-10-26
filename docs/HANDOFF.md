# 交接

## 当前任务

P0 已通过、设计已定稿（`design.md` + `tasks.md`），进入 **P1 实施**。下一步从 T1（workspaces 骨架）开始。

## 已完成

- 2026-10-26：**P0 全绿**（`spike/P0-RESULTS.md`）：字节切帧（含 U+2028）、流式→权威消息→`agent_settled`、`images` 多模态、扩展 `tool_call` 审批链路、`get_state`/模型能力。总耗时 24s。
- 2026-10-26：决策补全 —— 用途=个人开发者日常 agent；层级定四级、时间盒降级为标签；默认权限 L2；三端兼容；多模态支持。
- 2026-10-26：`design.md`（模块边界/WS 协议/元数据/对账/权限映射/多模态管线）、`tasks.md`（T1–T11）。
- 2026-10-26：读取 pi 1.4.0 文档（sdk / rpc / rpc-commands / json / rpc-extension-ui / cli-integration / security），确认可视化桌面的可行路径。
- 2026-10-26：结论——**不改 pi 源码**，用 `pi --mode rpc` + 本地 Bridge + Web UI；RPC 命令面覆盖会话/模型/思考档位/压缩/分叉/树/审批对话框。
- 2026-10-26：仓库骨架（AGENTS.md、docs/requirements、LESSONS、memory）建立。
- 2026-10-26：已定 —— 不改 pi 源码；外壳用 Tauri 2；核心心智为「会话中心 + 左侧四级层级树 + 右侧进度/落地面板」。
- 2026-10-26：调研到 pi 官方示例可直接复用逻辑：`permission-gate.ts` / `plan-mode/` / `todo.ts` / `protected-paths.ts` / `git-checkpoint.ts`（渲染需重写，TUI 组件在 RPC 下不可用）。

## 下一步

1. T1–T6：bridge 骨架（帧解析 / 会话包装 / 状态存储 / WS），全部用假 pi 子进程测试，不烧 token。
2. T7–T9：ui 三栏骨架 + 对话流 + 输入区（含图片）。
3. T10 前需用户确认安装 Rust 工具链（全局安装，需请示）；T11 真实端到端。

## 注意事项

- 未拍板的决策不许先写代码；P0 之前的代码都算"验证脚本"，不并入主干。
- 复用官方示例时注意：状态逻辑可直接用，渲染层是 TUI，迁到 RPC 必须重写。
- 审批阻塞的是单个 tool call（agent 在等），UI 断线必须 fail-closed。
- pi 文档路径带版本号（1.4.0），升级后需重新定位。
- 会话文件解析规则见 `session-format.md`，不要凭 jsonl 猜结构。
