# 交接

## 当前任务

P1 完成度较高：三栏 UI 已按产品视角重做（自绘标题栏、Markdown 渲染、右栏可折叠、历史回放），端到端与视觉均用 Playwright 实测过。下一步做 P3 权限网关（安全优先于加功能）。

## 已完成

- 2026-10-26：T1–T3 骨架 + shared 协议 + 帧解析（9 测试）。
- 2026-10-26：T4–T6 RpcSession / 事件归一化 / 状态存储 / WS 服务 / Bridge 路由（45 测试，假 pi 子进程，不烧 token）。
- 2026-10-26：T7–T9 三栏 UI（层级树 / 对话流 / 工具卡片 / 审批弹窗 / 进度面板）+ 图片粘贴。
- 2026-10-26：T10 Tauri 2 壳：自动拉起 bridge、把 url/token 注入页面；`cargo build` 通过，`tauri dev` 窗口正常。
- 2026-10-26：真实端到端 `npm run e2e` PASS（真 pi、真模型，流式与权威消息一致）。
- 2026-10-26：UI 重做（Playwright 实测截图验收）：自绘标题栏（mac 红黄绿让位 84px、可拖拽）、右栏可折叠、Markdown 渲染（代码块/表格/列表）、空消息过滤、滚动跟随、历史回放、同任务会话复用。
- 2026-10-26：**P0 全绿**（`spike/P0-RESULTS.md`）：字节切帧（含 U+2028）、流式→权威消息→`agent_settled`、`images` 多模态、扩展 `tool_call` 审批链路、`get_state`/模型能力。总耗时 24s。
- 2026-10-26：决策补全 —— 用途=个人开发者日常 agent；层级定四级、时间盒降级为标签；默认权限 L2；三端兼容；多模态支持。
- 2026-10-26：`design.md`（模块边界/WS 协议/元数据/对账/权限映射/多模态管线）、`tasks.md`（T1–T11）。
- 2026-10-26：读取 pi 1.4.0 文档（sdk / rpc / rpc-commands / json / rpc-extension-ui / cli-integration / security），确认可视化桌面的可行路径。
- 2026-10-26：结论——**不改 pi 源码**，用 `pi --mode rpc` + 本地 Bridge + Web UI；RPC 命令面覆盖会话/模型/思考档位/压缩/分叉/树/审批对话框。
- 2026-10-26：仓库骨架（AGENTS.md、docs/requirements、LESSONS、memory）建立。
- 2026-10-26：已定 —— 不改 pi 源码；外壳用 Tauri 2；核心心智为「会话中心 + 左侧四级层级树 + 右侧进度/落地面板」。
- 2026-10-26：调研到 pi 官方示例可直接复用逻辑：`permission-gate.ts` / `plan-mode/` / `todo.ts` / `protected-paths.ts` / `git-checkpoint.ts`（渲染需重写，TUI 组件在 RPC 下不可用）。

## 下一步

1. P3 权限网关：`extensions/permission`，`tool_call` 钩子 + 四档策略 + 受保护路径 + fail-closed。
2. P2 对账与落地：git diff、三轨对账、commit 落地区。
3. 未做：多会话并行 UI（会话池已支持）、模型切换 UI、打包（release 版 bridge 需随包分发）。

## 注意事项

- 未拍板的决策不许先写代码；P0 之前的代码都算"验证脚本"，不并入主干。
- 复用官方示例时注意：状态逻辑可直接用，渲染层是 TUI，迁到 RPC 必须重写。
- 审批阻塞的是单个 tool call（agent 在等），UI 断线必须 fail-closed。
- **权限网关尚未实现**：现在只有 pi 自带的工具执行，没有 `tool_call` 拦截，禁止在里面跑危险命令（P3 补）。
- 壳层启动 bridge 用的是 `env!("CARGO_MANIFEST_DIR")` + `npx tsx`，只适用于开发期；打包前必须换成随包分发的 bridge（TODO 已在 `src-tauri/src/bridge.rs` 标注）。
- pi 文档路径带版本号（1.4.0），升级后需重新定位。
- 会话文件解析规则见 `session-format.md`，不要凭 jsonl 猜结构。
