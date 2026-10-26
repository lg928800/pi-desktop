# 本仓库教训账本

> 格式：`- 日期 | 领域 | 坑 → 对策`。只追加不重写。
> 稳定成规则的，毕业进 `AGENTS.md`。

- 2026-10-26 | pi 集成 | TUI 是 ANSI 终端渲染，直觉上想"fork 改 Web"是错的 → RPC 模式本身就是官方给自定义 UI 留的通道，先查文档再谈改源码
- 2026-10-26 | 工具链 | TypeScript 7 移除了 `baseUrl`，且 import 带 `.ts` 后缀需显式 `allowImportingTsExtensions`，Node 全局类型需 `types:["node"]` → 新仓库先跑 `tsc --noEmit` 再写业务代码，别等写完才发现配置报错
