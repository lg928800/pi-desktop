# pi-desktop

把 [pi](https://github.com/earendil-works/pi)（coding agent CLI）的终端体验搬到桌面上：会话可视化、工具调用可视、审批可控、多任务并行。

## 状态

**开发中（P1）** — 设计定稿，P0 可行性已验证通过，正在搭 bridge/ui。

- 架构方向：**不改 pi 源码**，以 `pi --mode rpc` 子进程当引擎，本地 Bridge + Web UI 在其上做可视化。
- 依赖版本：pi 1.4.0（`@earendil-works/pi-coding-agent`）
- 需求与设计：`docs/requirements/INDEX.md`

## 怎么打开

**方式一：双击 App（推荐）**

新建项目时点「选择…」会弹 macOS 原生目录选择器（Tauri dialog 插件）。
右栏「可用模型」可点击切换，「＋ 配置」可新增 provider/模型（写入 `~/.pi/agent/models.json`，自动备份）。
对话区把「执行过程」收进终端流，结论单独展示为「结果」。

```bash
open src-tauri/target/release/bundle/macos/pi-desktop.app
```

也可以直接双击 `src-tauri/target/release/bundle/macos/pi-desktop.app`，或把它拖进「应用程序」。
这是原生窗口，不是浏览器 —— 界面用 WebView 渲染，Slack / VS Code 也是同样做法。

**方式二：开发模式**

```bash
npm install
npm run dev      # 自动起 vite + bridge + 原生窗口（改代码热更新）
```

**重新打包 App**

```bash
npm run build:app   # 产物：src-tauri/target/release/bundle/macos/pi-desktop.app
```

> 打包后的 App 通过 `npx tsx` 启动仓库里的 bridge，所以**仓库目录不能删/移动**。
> 要能脱离仓库分发，需要把 bridge 编译成单文件随包携带（P4 待做，环境变量 `PI_DESKTOP_BRIDGE_CMD` 已留口子）。

单独调试时：

```bash
npm run bridge:dev   # 只起 bridge，会打印带 token 的 ws 地址
npm run test         # 单测（53 个，用假 pi 子进程，不烧 token）
npm run e2e          # 真实模型端到端冒烟（会调用一次模型）
```

首次 `npm run dev` 需要 Rust 工具链；bridge 走 `npx tsx` 跑 TS 源码。

## 还差什么

- [`docs/ROADMAP.md`](docs/ROADMAP.md)：未完成事项（含验收标准）、扩展路线、已知限制
- 当前最重要的缺口：**权限网关未实现**（危险命令不会拦）与**会话重启失忆**

## 目录

```
docs/
  ROADMAP.md           未完成事项与扩展路线（开工前先读）
  requirements/        需求目录（requirement / design / tasks）
  HANDOFF.md           会话交接
  LESSONS.md           教训账本
  memory/MEMORY.md     项目记忆索引
```

## 红线

不改 pi 源码；不建数据库（会话以 `~/.pi/agent/sessions/**.jsonl` 为准）；密钥只留在 pi 的 `auth.json`。
详见 `AGENTS.md`。
