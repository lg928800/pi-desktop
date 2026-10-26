# pi-desktop

把 [pi](https://github.com/earendil-works/pi)（coding agent CLI）的终端体验搬到桌面上：会话可视化、工具调用可视、审批可控、多任务并行。

## 状态

**开发中（P1）** — 设计定稿，P0 可行性已验证通过，正在搭 bridge/ui。

- 架构方向：**不改 pi 源码**，以 `pi --mode rpc` 子进程当引擎，本地 Bridge + Web UI 在其上做可视化。
- 依赖版本：pi 1.4.0（`@earendil-works/pi-coding-agent`）
- 需求与设计：`docs/requirements/INDEX.md`

## 怎么跑

```bash
npm install
npm run dev      # Tauri 开发模式：自动启动 vite + bridge + 原生窗口
```

单独调试时：

```bash
npm run bridge:dev   # 只起 bridge，会打印带 token 的 ws 地址
npm run test         # 单测（53 个，用假 pi 子进程，不烧 token）
npm run e2e          # 真实模型端到端冒烟（会调用一次模型）
```

首次 `npm run dev` 需要 Rust 工具链；bridge 走 `npx tsx` 跑 TS 源码。

## 目录

```
docs/
  requirements/        需求目录（requirement / design / tasks）
  HANDOFF.md           会话交接
  LESSONS.md           教训账本
  memory/MEMORY.md     项目记忆索引
```

## 红线

不改 pi 源码；不建数据库（会话以 `~/.pi/agent/sessions/**.jsonl` 为准）；密钥只留在 pi 的 `auth.json`。
详见 `AGENTS.md`。
