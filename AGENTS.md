# pi-desktop — pi 引擎的可视化桌面端

> **接手/换模型时先读 [`docs/ONBOARDING.md`](docs/ONBOARDING.md)**：30 秒理解项目、5 分钟上手命令、已踩过的坑、验证纪律。
> 还差什么看 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

## 项目定位

把 coding agent（pi）的终端体验搬进桌面：会话列表、流式消息、工具调用卡片、文件 diff、危险操作审批、多会话并行。

- **pi 是引擎，不是依赖库的替代品**：以 `pi --mode rpc` 长驻子进程运行，通过 stdin/stdout 的 JSONL 协议双向通信。
- 依赖版本：`@earendil-works/pi-coding-agent` **1.4.0**
- pi 文档（只读参考）：`/Users/Zhuanz/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent/docs`
  （关键篇目：`rpc.md`、`rpc-commands.md`、`json.md`、`rpc-extension-ui.md`、`session-format.md`、`message-types.md`）
- 注意：pi 升级后上面的路径版本号会变，实施时以 `which pi` 反查实际安装目录为准。

## 架构红线（违反即返工）

1. **不 fork pi、不改 pi 的源码或 `dist/`**。需要的能力优先在 RPC 协议里找；协议没有的，先在 `docs/requirements/` 记录诉求。
2. **不建数据库**。会话元数据与内容以 `~/.pi/agent/sessions/**.jsonl` 为唯一事实源，运行时状态走 RPC（`get_state` / `get_messages` / `get_tree`）。禁止双写。
3. **JSONL 帧解析必须按字节流以 `\n` 切分**。禁用 Node `readline`——它额外按 `U+2028`/`U+2029` 切，而这两个字符在 JSON 字符串内合法。
4. **一次运行的结束信号是 `agent_settled`**，不是 `agent_end`（后者之后还可能跟重试、压缩恢复、排队消息）。
5. **密钥只留在 pi 的 `auth.json`**。Bridge 与 UI 永不接触明文 key，也不许回显。
6. **审批默认开启**：危险 bash、写文件必须经 UI 确认并留痕，不设隐藏的自动批准。
7. **UI 不在场必须 fail-closed**：审批无人应答时阻塞动作，绝不默认放行。
8. **落地（commit）只能由人触发**，agent 与扩展都无权自动提交。
9. **右侧面板不许只显示 agent 的自述**：计划（意图）、git（实际）、审批记录三轨必须对账，不一致就标红。

## 模块注册表

| 模块 | 路径 | 职责 | 依赖 | 测试命令 |
| ---- | ---- | ---- | ---- | -------- |
| ui | `src/ui` | 三栏界面：层级树 / 对话 / 进度与落地 | bridge 的 WS 协议 | TODO(待确认) |
| bridge | `src/bridge` | 会话池、RPC 帧解析、任务元数据、git 落地、三轨对账 | pi 子进程 | TODO(待确认) |
| shared | `src/shared` | WS 消息与事件类型（前后端共用） | — | TODO(待确认) |
| ext-permission | `extensions/permission` | `tool_call` 网关：四档策略、审批、受保护路径 | pi Extension API | TODO(待确认) |
| ext-plan | `extensions/plan` | 计划步骤与 `[DONE:n]` 完成标记，供右栏消费 | pi Extension API | TODO(待确认) |
| shell | `src-tauri` | Tauri 壳：窗口、托盘、全局快捷键、通知 | ui 构建产物 | TODO(待确认) |

上表是 P0 后的规划分层，路由与命名以 `docs/requirements/2026-10-26-pi-desktop-mvp/requirement.md` 为准。

## 全局约定

- 需求放 `docs/requirements/`，交接放 `docs/HANDOFF.md`。
- 新增/修 bug 前先看 `docs/LESSONS.md` 有没有同类坑。
- 构建与测试只跑受影响模块；改共享类型必须跑下游。
- **未拍板的产品决策不许默认执行**，统一列在 `docs/requirements/2026-10-26-pi-desktop-mvp/requirement.md` 的「待拍板」节，等用户确认。
