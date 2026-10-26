# 交接

## 当前任务

pi-desktop 仓库初始化完成，进入**设计评审**：技术方案已提出，等待用户拍板 5 项决策。

## 已完成

- 2026-10-26：读取 pi 1.4.0 文档（sdk / rpc / rpc-commands / json / rpc-extension-ui / cli-integration / security），确认可视化桌面的可行路径。
- 2026-10-26：结论——**不改 pi 源码**，用 `pi --mode rpc` + 本地 Bridge + Web UI；RPC 命令面覆盖会话/模型/思考档位/压缩/分叉/树/审批对话框。
- 2026-10-26：仓库骨架（AGENTS.md、docs/requirements、LESSONS、memory）建立。

## 下一步

1. 用户拍板 `requirement.md` 里「待拍板」的 5 项（技术路径 / MVP 形态 / 核心心智 / 项目位置已定 / 首个真实用途）。
2. 拍板后：写 `design.md`，再写逐任务实施计划（`tasks.md`）。
3. 执行 P0 可行性验证（跑通 RPC + 审批对话框应答）。

## 注意事项

- 未拍板的决策不许先写代码；P0 之前的代码都算"验证脚本"，不并入主干。
- pi 文档路径带版本号（1.4.0），升级后需重新定位。
- 会话文件解析规则见 `session-format.md`，不要凭 jsonl 猜结构。
