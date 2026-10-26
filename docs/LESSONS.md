# 本仓库教训账本

> 格式：`- 日期 | 领域 | 坑 → 对策`。只追加不重写。
> 稳定成规则的，毕业进 `AGENTS.md`。

- 2026-10-26 | pi 集成 | TUI 是 ANSI 终端渲染，直觉上想"fork 改 Web"是错的 → RPC 模式本身就是官方给自定义 UI 留的通道，先查文档再谈改源码
- 2026-10-26 | 工具链 | TypeScript 7 移除了 `baseUrl`，且 import 带 `.ts` 后缀需显式 `allowImportingTsExtensions`，Node 全局类型需 `types:["node"]` → 新仓库先跑 `tsc --noEmit` 再写业务代码，别等写完才发现配置报错
- 2026-10-26 | Tauri 壳 | `titleBarStyle: "Overlay"` 下红黄绿按钮会压住网页左上角 → 标题栏必须给 mac 留 ~84px 左内边距，并整条设为拖拽区（`-webkit-app-region: drag`，按钮单独 `no-drag`）
- 2026-10-26 | 多会话 | bridge 的广播没有 sessionId 过滤，两个会话的事件会串到同一个 UI → 前端按 `sessionId` 丢弃非当前会话事件
- 2026-10-26 | 幂等 | 重复点击同一任务会反复 `session.start`，一次测试里开出了 8 个 pi 子进程 → 同一 task 已有活会话时必须复用并重新 announce header
- 2026-10-26 | 渲染 | 只有工具调用的助手消息文本为空，会渲染成一个空气泡 → `text` 为空且无图片时从时间线移除
