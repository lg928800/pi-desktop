# pi-desktop

把 [pi](https://github.com/earendil-works/pi)（coding agent CLI）的终端体验搬到桌面上：会话可视化、工具调用可视、审批可控、多任务并行。

## 状态

**设计阶段** — 骨架已建，技术方案待拍板，尚无代码。

- 架构方向：**不改 pi 源码**，以 `pi --mode rpc` 子进程当引擎，本地 Bridge + Web UI 在其上做可视化。
- 依赖版本：pi 1.4.0（`@earendil-works/pi-coding-agent`）
- 需求与设计：`docs/requirements/INDEX.md`

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
