# pi-desktop 记忆索引（≤200 行）

> 分区：project=本项目决策/事实；reference=外部资源位置。详情写 `docs/memory/<主题>.md`，这里只留指针。

## project

- 2026-10-26 | 定位 = pi 的可视化桌面端；架构红线 = 不改 pi 源码，`pi --mode rpc` 当引擎（详见根 AGENTS.md）
- 2026-10-26 | 已定：独立仓库位置 `~/onlyProject/pi-desktop`，不并入 rea（避免污染 rea 的需求索引与模块注册表）
- 2026-10-26 | 待定：MVP 形态（本地 Web vs 套壳）、核心心智（会话中心 vs 任务看板）、首个真实用途

## reference

- pi 安装目录：`/Users/Zhuanz/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent`（升级后版本号会变）
- pi RPC 示例代码：同目录 `examples/rpc-client.ts`、`examples/rpc-extension-ui.ts`
- pi HTML 导出模板（可复用渲染参考）：`dist/core/export-html/`
