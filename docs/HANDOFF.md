# 交接

## 当前任务

P1 主体完成（T1–T10）：bridge / UI / Tauri 壳均可运行，真实端到端已通。下一步 T11 人工验收 + P2（右侧对账与落地区）。

## 已完成

- 2026-10-26：T1–T3 骨架 + shared 协议 + 帧解析（9 测试）。
- 2026-10-26：T4–T6 RpcSession / 事件归一化 / 状态存储 / WS 服务 / Bridge 路由（45 测试，假 pi 子进程，不烧 token）。
- 2026-10-26：T7–T9 三栏 UI（层级树 / 对话流 / 工具卡片 / 审批弹窗 / 进度面板）+ 图片粘贴。
- 2026-10-26：T10 Tauri 2 壳：自动拉起 bridge、把 url/token 注入页面；`cargo build` 通过，`tauri dev` 窗口正常。
- 2026-10-26：真实端到端 `npm run e2e` PASS（真 pi、真模型，流式与权威消息一致）。
- 2026-10-26：**P0 全绿**（`spike/P0-RESULTS.md`）：字节切帧（含 U+2028）、流式→权威消息→`agent_settled`、`images` 多模态、扩展 `tool_call` 审批链路、`get_state`/模型能力。总耗时 24s。
- 2026-10-26：决策补全 —— 用途=个人开发者日常 agent；层级定四级、时间盒降级为标签；默认权限 L2；三端兼容；多模态支持。
- 2026-10-26：`design.md`（模块边界/WS 协议/元数据/对账/权限映射/多模态管线）、`tasks.md`（T1–T11）。
- 2026-10-26：读取 pi 1.4.0 文档（sdk / rpc / rpc-commands / json / rpc-extension-ui / cli-integration / security），确认可视化桌面的可行路径。
- 2026-10-26：结论——**不改 pi 源码**，用 `pi --mode rpc` + 本地 Bridge + Web UI；RPC 命令面覆盖会话/模型/思考档位/压缩/分叉/树/审批对话框。
- 2026-10-26：仓库骨架（AGENTS.md、docs/requirements、LESSONS、memory）建立。
- 2026-10-26：已定 —— 不改 pi 源码；外壳用 Tauri 2；核心心智为「会话中心 + 左侧四级层级树 + 右侧进度/落地面板」。
- 2026-10-26：调研到 pi 官方示例可直接复用逻辑：`permission-gate.ts` / `plan-mode/` / `todo.ts` / `protected-paths.ts` / `git-checkpoint.ts`（渲染需重写，TUI 组件在 RPC 下不可用）。

## 下一步

1. 人工验收：`npm run dev` 打开窗口 → 建项目/功能集/任务 → 开会话 → 发指令 → 看图与工具卡片 → 中断。
2. P2：右侧三轨对账（计划 / git / 审批）+ 落地区（diff 预览 + commit）。
3. P3：权限四档网关（**当前尚未实现，危险命令不会拦截**）。

## 注意事项

- 未拍板的决策不许先写代码；P0 之前的代码都算"验证脚本"，不并入主干。
- 复用官方示例时注意：状态逻辑可直接用，渲染层是 TUI，迁到 RPC 必须重写。
- 审批阻塞的是单个 tool call（agent 在等），UI 断线必须 fail-closed。
- **权限网关尚未实现**：现在只有 pi 自带的工具执行，没有 `tool_call` 拦截，禁止在里面跑危险命令（P3 补）。
- 壳层启动 bridge 用的是 `env!("CARGO_MANIFEST_DIR")` + `npx tsx`，只适用于开发期；打包前必须换成随包分发的 bridge（TODO 已在 `src-tauri/src/bridge.rs` 标注）。
- pi 文档路径带版本号（1.4.0），升级后需重新定位。
- 会话文件解析规则见 `session-format.md`，不要凭 jsonl 猜结构。
