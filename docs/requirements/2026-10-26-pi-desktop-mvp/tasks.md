# P1 实施计划（最小可用垂直切片）

> 依据 `design.md`。每项结束都要有可执行的验证命令；不许"写完就算"。
>
> **2026-10-26 状态**：T1–T10 完成并有测试/截图证据；T11（真人验收）由用户日常使用中完成。
> 原则：bridge 的可测逻辑用 **假 pi 子进程**（脚本回放 JSONL）测试，**不烧 token**；只有 T11 做一次真实端到端。

## T1 仓库骨架（npm workspaces）

- `package.json`（workspaces: `src/shared`、`src/bridge`、`src/ui`）、`tsconfig.base.json`
- 各包 `package.json` + `tsconfig.json`；`vitest` 装在根
- `.nvmrc` 固定 Node 版本

**验证**：`npm run -w src/bridge test`（空跑通过）、`npx tsc -b`

## T2 shared：协议与领域类型

- `src/shared/protocol.ts`：`ClientOp` / `ServerEvent` 联合类型（对照 design.md §3）
- `src/shared/domain.ts`：`Project` / `Feature` / `Task` / `Session` / `Attachment` / `PermissionLevel`
- 穷尽性检查：`switch` 上写 `satisfies never`，新增事件漏处理时编译报错

**验证**：`npx tsc -b src/shared`

## T3 bridge：帧解析

- `src/bridge/frame-splitter.ts` —— 从 `spike/rpc-smoke.mjs` 提炼，按字节 `0x0A` 切
- 测试用例：CRLF、U+2028/U+2029 在字符串内、逐字节分片、空行、超长行（>1MB）

**验证**：`npm run -w src/bridge test -- frame-splitter`

## T4 bridge：RpcSession（会话包装）

- `spawn("pi", ["--mode","rpc","--no-session", ...])`，`cwd` = 项目根
- 命令发送 + `id` 关联 + 超时；事件归一化为 `ServerEvent`
- `agent_settled` → `run.settled`；`message_end` → `message.final`（覆盖 delta）
- 假子进程 `src/bridge/__fixtures__/fake-pi.mjs`：读 stdin 命令、回放固定 JSONL（含 delta/工具/审批）

**验证**：`npm run -w src/bridge test -- rpc-session`（全用假进程，0 token）

## T5 bridge：状态存储

- `src/bridge/state-store.ts`：读 `~/.pi-desktop/state.json`，原子写（tmp + rename），版本号校验
- 迁移策略：`version` 不认识就备份原文件后重建
- 测试：并发写不丢字段、损坏 JSON 的降级路径

**验证**：`npm run -w src/bridge test -- state-store`

## T6 bridge：WS 服务

- 仅绑 `127.0.0.1`，启动生成 token，握手校验；非本地来源拒绝
- `op` 路由 → 会话管理器；未知 `op` 返回结构化错误
- 二期才做：断线重连现场恢复

**验证**：`npm run -w src/bridge test -- ws-server`（本地 ws 客户端跑通 project.list / tree.get）

## T7 ui：三栏骨架

- React + Vite；左树（项目/功能集/任务，可折叠）+ 中间占位 + 右侧折叠面板（先空）
- 数据来自 `tree.get`；空态给"新建项目"引导
- **只用标准 Web API**（WebKit 兼容）

**验证**：`npm run -w src/ui dev`，Safari 打开无报错（等价 WKWebView）

## T8 ui：对话流

- `message.delta` 拼接 → `message.final` 替换；Markdown 渲染
- 工具卡片：`read`（文件+行号）、`edit`（内联 diff）、`bash`（xterm.js 只读渲染）
- 虚拟滚动（>200 条消息时不掉帧）

**验证**：用假子进程回放一段 500 条消息的会话，滚动 60fps

## T9 ui：输入区

- 文本 + 图片（粘贴/拖拽/选文件），超 8MB 先降采样
- 模型选择器：读 `model.list`，按 `input` 是否含 `image` 控制附件按钮可用性
- 中断按钮 → `run.abort`

**验证**：粘贴截图 → 发送 → 模型回答"红色"类语义正确

## T10 壳：Tauri 2

- `rustup` 工具链安装（**需用户确认，属全局安装**）
- 窗口加载 ui 构建产物；自定义标题栏；托盘；`platform.keymap`（`Mod` = Cmd/Ctrl）
- `platform.spawnAgent()` 处理 Windows `pi.cmd`

**验证**：`npm run tauri dev` 出现原生窗口；`npm run tauri build` 出 .app

## T11 真实端到端

- 用它在 `pi-desktop` 自己身上做一个小改动（例如给右栏加一个按钮）
- 检查：流式无卡顿、工具卡片正确、中断有效、退出后会话仍在

**验证**：录屏 + 一份手写验收记录，附在 `docs/HANDOFF.md`

## 依赖顺序

`T1 → T2 → T3 → T4 → T5 → T6`（bridge 可独立测完）
`T7 → T8 → T9`（可用 mock 事件并行推进）
`T10` 依赖 T7；`T11` 依赖全部。

## 风险

| 风险 | 处理 |
| --- | --- |
| Rust 工具链安装耗时/失败 | T10 前置于 T1–T9 之后，桥接层不被阻塞 |
| WKWebView 与 Chromium 渲染差异 | 开发期就用 Safari 验收（macOS 即 WKWebView） |
| 工具卡片渲染量大 | 先做折叠 + 虚拟滚动，diff 只在展开时计算 |
| 假子进程与真 pi 行为漂移 | T11 用真 pi 跑一遍，把差异补回 fixture |
