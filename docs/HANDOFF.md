# 交接

## 当前任务

pi-desktop 进入**设计评审**：三栏形态（层级树 / 对话 / 进度与落地）与四档权限模型已按用户描述落成 `requirement.md`，待评审后写实施计划。

## 已完成

- 2026-10-26：读取 pi 1.4.0 文档（sdk / rpc / rpc-commands / json / rpc-extension-ui / cli-integration / security），确认可视化桌面的可行路径。
- 2026-10-26：结论——**不改 pi 源码**，用 `pi --mode rpc` + 本地 Bridge + Web UI；RPC 命令面覆盖会话/模型/思考档位/压缩/分叉/树/审批对话框。
- 2026-10-26：仓库骨架（AGENTS.md、docs/requirements、LESSONS、memory）建立。
- 2026-10-26：已定 —— 不改 pi 源码；外壳用 Tauri 2；核心心智为「会话中心 + 左侧四级层级树 + 右侧进度/落地面板」。
- 2026-10-26：调研到 pi 官方示例可直接复用逻辑：`permission-gate.ts` / `plan-mode/` / `todo.ts` / `protected-paths.ts` / `git-checkpoint.ts`（渲染需重写，TUI 组件在 RPC 下不可用）。

## 下一步

1. 用户评审 `requirement.md`，确认剩余 3 项待拍板：首个真实用途、层级是否只要四级（要不要时间盒维度）、默认权限档位是否 L1。
2. 评审通过后：写 `design.md`（模块边界 + WS 协议 + 元数据格式），再写逐任务实施计划（`tasks.md`）。
3. 执行 P0 可行性验证（跑通 RPC + 扩展 `tool_call` 弹 confirm 并由脚本应答）。

## 注意事项

- 未拍板的决策不许先写代码；P0 之前的代码都算"验证脚本"，不并入主干。
- 复用官方示例时注意：状态逻辑可直接用，渲染层是 TUI，迁到 RPC 必须重写。
- 审批阻塞的是单个 tool call（agent 在等），UI 断线必须 fail-closed。
- pi 文档路径带版本号（1.4.0），升级后需重新定位。
- 会话文件解析规则见 `session-format.md`，不要凭 jsonl 猜结构。
