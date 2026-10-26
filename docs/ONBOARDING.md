# 接手须知（任何模型先读这份）

> 这个仓库是给 AI 代理接手准备的。读完这一页你就能直接开工，不需要重新探索。
> 读的顺序：**本文件 → `AGENTS.md`（红线）→ `docs/ROADMAP.md`（还差什么）→ `docs/requirements/2026-10-26-pi-desktop-mvp/`（为什么这么设计）**

---

## 1. 三十秒理解这个项目

**pi-desktop = 把 pi（coding agent CLI）的可视化桌面端。**

- 引擎：`pi --mode rpc` 子进程，JSONL 双向通信。**不 fork、不改 pi 源码**。
- 后端 `src/bridge`：会话池、帧解析、事件归一化、任务元数据、WS 服务。
- 前端 `src/ui`：三栏（层级树 / 对话 / 进度），React + Vite。
- 外壳 `src-tauri`：Tauri 2，负责开窗口、拉起 bridge、注入 `{url, token}`。

```
UI (React) ──WS── bridge (Node) ──JSONL── pi 子进程 × N
                      └── ~/.pi-desktop/state.json（层级元数据）
```

## 2. 五分钟上手

```bash
cd ~/onlyProject/pi-desktop
npm run test          # 50 个单测（用假 pi 子进程，不烧 token，秒级）
npx tsc --noEmit      # 类型检查，必须干净
npm run dev           # 开发模式：vite + 窗口（改 UI 热更）
npm run build:app     # 出 .app（需要 PATH 里有 rust：export PATH="/opt/homebrew/opt/rustup/bin:$PATH"）
npm run e2e           # 真实模型端到端（会调用一次模型，花几厘钱）
```

浏览器里验收 UI（我常用的方式）：

```bash
npm run -w @pi-desktop/ui dev &            # 5173
PI_DESKTOP_PORT=8799 PI_DESKTOP_TOKEN=demo-token \
  PI_DESKTOP_STATE=/tmp/demo/state.json npx tsx src/bridge/src/main.ts &
# 然后打开 http://localhost:5173/?bridge=ws://127.0.0.1:8799/&token=demo-token
```

## 3. 必须守住的红线（`AGENTS.md` 有完整版）

1. **不 fork / 不改 pi 源码**。能力缺口用 pi 的扩展机制补（`pi.on("tool_call")` 等）。
2. **不建数据库**。会话以 `~/.pi/agent/sessions/**.jsonl` 为唯一事实源，我们只存层级元数据。
3. **JSONL 按字节 `\n` 切帧**，禁用 Node `readline`（会误切 `U+2028`/`U+2029`）。
4. **结束信号只认 `agent_settled`**，不是 `agent_end`。
5. **审批 fail-closed**：UI 不在场就阻塞，绝不默认放行。
6. **落地（commit）只能人触发**，agent 与扩展无权自动提交。
7. **右栏不许只复述 agent 自述**，必须与 git 事实对账。

## 4. 当前进度（2026-10-26，commit `60614c3`）

| 项 | 状态 |
|---|---|
| P0 可行性验证 | ✅ RPC 切帧 / 流式 / 多模态 / 审批链路，全绿 |
| P1 单会话可视化 | ✅ 三栏 UI、流式对话、工具终端流、结果卡片、模型切换、原生选目录、历史回放 |
| mac `.app` | ✅ 可双击（5.95 MB），已推送 GitHub（public） |
| **权限网关** | ❌ 未实现 —— 当前危险命令**不会**被拦 |
| 会话持久化 | ❌ `sessionFile` 仍为 null，重启即失忆 |
| 落地 / 对账 | ❌ 未实现 |

## 5. 下一步做什么（不要自己另起炉灶）

按 `docs/ROADMAP.md` §7 的顺序：**权限网关 → 会话持久化 → 落地与对账 → 多会话 UI → 打包**。

第一条的具体验收标准在 `docs/ROADMAP.md` §1.1，写得很细（L0/L1 行为、fail-closed、真 pi 验证），照着做即可。

## 6. 已经踩过的坑（省你两小时）

| 坑 | 结论 |
|---|---|
| TypeScript 7 | `baseUrl` 已移除；`.ts` 后缀 import 要 `allowImportingTsExtensions`；Node 全局类型要 `types:["node"]` |
| `window.prompt` | **WKWebView 不实现**，桌面端会静默失败 → 一律用内联表单组件 |
| Finder 双击启动 | 进程 PATH 只有 `/usr/bin:/bin`，找不到 npx/node → Rust 侧必须补 PATH（`src-tauri/src/bridge.rs`） |
| Tauri 标题栏 | `titleBarStyle: "Overlay"` 下红黄绿会压住页面左上角 → 留 84px + `-webkit-app-region: drag` |
| 多会话 | bridge 是全局广播，前端必须按 `sessionId` 过滤，否则串台 |
| 重复点击任务 | 会重复 `session.start` 开一堆子进程 → 同任务必须复用活会话 |
| models.json | 是 **JSONC（带注释）**，直接 parse+stringify 会抹掉注释 → 用 `jsonc-parser` 局部修改 |
| GitHub 推送 | 钥匙串里的 token 可能是**按仓库授权**的 fine-grained PAT，新仓库会 403 → `gh auth login` + `gh auth setup-git` |
| DMG 打包 | 本机挂着其他 dmg 时 `hdiutil` 会忙 → `bundle.targets` 先只出 `app` |

## 7. 这个项目的验证纪律

**声明完成前必须实际跑过**（用户的硬要求）：

- 改 bridge/shared：`npx tsc --noEmit && npx vitest --run`（必须 50 个全绿）
- 改 UI：`npm run -w @pi-desktop/ui build`，并用浏览器或 Playwright **截图肉眼确认**，不要只相信代码
- 改壳：`cargo build`（在 `src-tauri/`），必要时 `npm run build:app`
- 涉及真实对话：`npm run e2e`
- 不许用"应该能跑"结案

## 8. 用户偏好（会直接影响你的做法）

- 中文交流；代码/commit message 可英文
- Java 后端背景，偏好轻量方案，**反感全家桶**
- 讨厌"只做表面"：要产品思维、要能验证、要能对账
- 要求先给方案再动手；不确定就问，不要擅自扩大范围
