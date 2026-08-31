# 官方 DSH 更新与 Relay 插件兼容性检查

> 后续实施已完成：见[全部 10 个插件的适配与验收结果](ADAPTATION.zh.md)。下文保留适配前的审计结果。

检查日期：2026-08-31，Asia/Shanghai。

**结论：源码同步完成，但当前插件组合不能直接升级到这次官方 alpha。**
Codex / Claude 有已复现的宿主加载阻断；8 个包含 Web 前端的插件均存在新版本类型接口适配工作。
Events / Semantic Router / Monitors 的核心事件机制仍可保留，不需要因官方新增 Webhook 而重写。

## 版本与范围

| 项目 | 检查值 |
| --- | --- |
| 原官方基线 | `0.1.1-rc.2`，`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` |
| 新官方基线 | `0.1.2-alpha.2`，`0a53fb55bea101816fa226bb964ae2bed71c343b` |
| 官方来源 | `https://github.com/deepseek-ai/deepseek-harness.git` 的 `master` |
| 提交范围 | GitHub compare 返回新增 1,313 个提交，包含合并提交 |
| 净文件差异 | `git -c diff.renameLimit=10000 diff --shortstat OLD NEW`：6,451 文件，+305,637 / -94,907 行 |
| 工具环境 | Node `25.5.0`，pnpm 实际调用版本 `11.19.0`；上游声明 `pnpm@11.7.0` |

文件数包含文档、Agent Notes、测试快照、大量移动和重命名，并不代表同等数量的产品功能改动。
官方源码保持 detached HEAD、仅官方 origin、禁用 push；没有修改官方源码、插件产品源码、版本或 gitlink，没有提交、发布或重启日常服务。
本次针对工作区实际插件提交检查，保留了检查前已有的未提交文件；具体提交见 `verification.json`。

## 官方这次主要修改

1. **客户端架构拆分**：删除 `@deepseek-ai/dsh-client-runtime` 和 `@deepseek-ai/dsh-host-apiproxy`。
   Session / Workspace / Settings API 转入各自 Controller，通信统一到 Remote / Gateway；状态存储、React 会话适配、Chat、Trajectory、Approval 分别由独立包负责。
2. **输入和对话体验**：Lexical contenteditable 替换 textarea；增加乐观提交回显、回合导航、过程折叠、每回合 token/耗时展示、字号和内容宽度控制、连接恢复提示，以及提醒/计划展示。
3. **会话持久化与投影**：更多状态通过 projection 读取；缓存改进、可借用的 prepared Session、空会话持久化，以及日志存储压缩改进。
   注意最终版本仍是 `SESSION_FORMAT_VERSION = 0`，并未提供通用历史迁移保证；中间出现过的 format migration 和删除 ignorable 的改动均有回退，不能直接用中间提交标题描述最终行为。
4. **外部事件**：新增通用 Webhook runtime 和签名验证的 GitHub adapter，可按可信规则在 Workspace 内创建新会话。
5. **子代理与运行入口**：官方 Codex / Claude 子代理增加模型选择配置；ACP、TypeScript/Python SDK 使用 profile 入口；另增实验性 Agent Teams、浏览器 Worker runtime、Inspector。它们不等于 Relay 的 Codex / Claude 主会话后端。
6. **插件与发布**：插件列表按预设/作用域展示，内置预设归属调整；Cordis 升到 `4.0.2`；模块 HMR 改为显式启用，profile 声明 patch reload 策略；区分 alpha / rc 发布渠道。
7. **Web 安全和资源加载**：浏览器首次访问需要启动 URL 的 token 换取 cookie；客户端资源改用启动 graph 公布的、有 revision 的 combo URL。

主要依据：新版本 `packages/api/*-controller`、`packages/client/{ui-conversation,ui-chat,store,connection,modules}`、`packages/session`、`packages/webhook`、`packages/bundle/base/cordis.patch.yml` 和两端提交的净 diff。

## 已确认的冲突

### P1：Codex / Claude 宿主无法加载

官方 `dsh-llm` 删除 `CallId` 导出，改为 `ToolCallId`。
受影响的实际调用包括：

- `integrations/codex/codex-adapter.js:4`
- `integrations/codex/dsh-import-target.js:4`
- `integrations/claude/dsh-import-target.js:3`

对新官方构建执行真实 ESM import，两者均报：

```text
SyntaxError: The requested module '@deepseek-ai/dsh-llm' does not provide an export named 'CallId'
```

这不是类型检查告警：安装现有 tarball 后也会使官方 Web Host 的插件树启动失败。
需要在各插件仓库适配导出名称，随后回归工具活动、历史导入、继续会话和事件唤醒。

### P1：旧 Runtime、会话和 Chat 扩展接口被移除/迁移

8 个有前端的插件仍导入旧 Runtime：Codex、Claude、Session Import、Workbench、Files、Terminal、Events、Plugin Manager。
隔离旧 npm 依赖，完全指向新官方声明后，8 个前端的类型检查均失败。

| 旧用法 | 新版本的所有者 / 需要处理的变化 |
| --- | --- |
| `ClientContext` 来自 `dsh-client-runtime/client` | 使用 Cordis `Context`，显式引入实际服务及 UI adapter 的类型扩展 |
| `defineStore`、`EngineStoreHandle` 来自 Runtime | `@deepseek-ai/dsh-client-store` |
| `SessionId` 从 Runtime 转导出 | `@deepseek-ai/dsh-session/types` |
| `ChatNodeOwnerProps` / `ChatNodeViewProps` 来自 ui-conversation | 转到 `@deepseek-ai/dsh-client-ui-chat/client` |
| `ctx.conversationEvents.register(...)` | 新的 `ctx.uiConversation.events` 所有权，需要对照新定义重新接入 |
| `connection.api.sessions.models/selectModel` | `connection.api` 已删除，改接 Session Controller / Remote 模型接口 |
| `ctx.sessions.currentProvideInfo` | 新 Session 服务不再提供此成员，需要重新实现打开会话时的订阅 |

Codex 的过程面板还依赖旧 Chat renderer 的 `locale === 'conversation'` 检查；新版 renderer 使用 `chat`，并新增原生回合过程折叠。
原有防御检查会放弃接管，不能仅修 import 就认为过程展示已适配。需要检查活动合并、最终答案、上下文隐藏和原生折叠是否重复或遗漏。

### P1：Workbench / Files 的具体 UI 契约变化

- Workbench 的 `stores.ts` 有旧 Runtime 的运行时 import，而不只是 type import。它替换了官方 `ui-layout`，因此会连带影响 Files / Terminal。
- 官方新 AppFrame 在严格的 details 会话区域使用 `SessionProvider`；Relay AppFrame 仍直接渲染 details，需要同步新的作用域处理。
- Files 的 Markdown 预览在 `FileExplorer.tsx:284` 调用 `<MarkdownText text={...} />`；新组件要求显式 `labels: MarkdownLabels`，隔离编译复现 `TS2741`。
- `useSessions` 等 standard props 的声明归属转到 `ui-session`，需补充服务类型扩展，而不是用 `any` 消除错误。

真实浏览器分别加载 Workbench、Workbench + Files、Workbench + Terminal，均捕获到
`cannot get required service "sessions" in inactive context`。这是现有构建产物的运行时失败，和上述源码编译问题分别记录。

### P2：开发准备脚本、依赖范围和验收脚本过期

1. 9 个插件的 `npm run verify` 都在 `prepare:dsh` 的旧 `dsh-client-runtime` 前置检查处停止。
   包括本不需要前端 Runtime 的 Semantic Router / Monitors，说明准备脚本的依赖清单也需要按实际用途收窄。
2. 8 个插件现有 DSH peer 范围在标准 semver 规则下不接受 `0.1.2-alpha.2`。
   `<0.2.0` 不意味着自动接受未来 minor 的 prerelease。不能仅强行忽略 peer 告警；可能装入旧 DSH 包，造成混合版本。
3. Plugin Manager 原工作区的 `npm run verify` 返回成功，但解析到的是旧 `dsh-llm` / UI `0.1.1-rc.2`、Cordis `4.0.1`。
   它的官方 CLI 安装/config-dump 检查确实运行在新 DSH 上，但不证明源码已对新声明完成编译。隔离后仍有旧 Runtime import 错误。
4. 旧 `verify-dsh-official-install.mjs` 未交换启动 token，首次首页检查返回 404；其 `/plugins/<name>/client.js` 断言也不再对应新 combo 资源协议。
   浏览器验收需跟随合法启动 URL、cookie 和 `window.__DSH_BOOT__` 中的实际资源 URL，不能关闭新认证来让测试通过。
5. `scripts/verify-dsh-ui-e2e.mjs:255` 仍查找 textarea。新版输入框为 contenteditable，需要更新交互选择器。

## 哪些不冲突，哪些只是功能重叠

- `Agent.followup()`、`agent/inbox/spliced`、`sessions.flush()` 仍在。Relay 的持久化投递确认和 activation ID 去重仍有可用的官方边界。
- 最终版本保留 `SessionEvent.ignorable?: true`。不能把中间“删除 ignorable”的提交误报为本次最终版本的兼容破坏。
- 官方 Webhook 是按规则**创建新会话**，目前为进程内 dispatch，无内置持久化队列、重试或去重。Relay 则面向已有 Session 的 Wait / Event / Delivery 和 durable Monitor；两者有入口能力重叠，但不等价。
- Plugin Manager 的 `settings.plugins.tab`、Session Import 的 `sidebar.footer.action` 仍存在。纯 UI 帮助/入口的迁移规模小于 Codex 主会话和 Workbench，不能把 type import 失败一律说成运行时不能加载。
- 新版仍采用公开 Cordis / profile 插件机制，没有要求把我们的插件改成 DSH Fork。

## 隐私变化需要单独审核

- `plugin-package-inventory-deepseek` 默认开启：官方 DeepSeek 请求可附加活动插件的 `{name, version}` 清单，字段在模型消息之外。
- `session-log-deepseek` 默认 `enabled: false`：增量会话日志上传需要显式启用，不能描述为默认上传所有会话。
- 默认 telemetry 模式为 `FEEDBACK_ONLY`；源码说明反馈触发的导出包含捕获的会话记录，需要结合 Relay 的客户数据边界审核。

以上不是“Codex/Claude 的每个请求都会上传给 DeepSeek”的结论。本次没有启用日志上传、调用真实模型或使用真实客户会话；Web 检查使用临时 profile 并设置 `DSH_TELEMETRY_DISABLED=1`。

## 验证证据

- `scripts/sync-dsh.sh` 成功，官方工作区 clean。
- `pnpm install --frozen-lockfile --ignore-scripts` 成功。
- 初次增量 build 被已删除包的旧 `lib/types` 输出干扰；使用官方 `pnpm run clean` 清理 269 个生成输出路径后，`pnpm run build` 成功。此问题不归类为官方源码编译缺陷。
- 现有仓库边界测试：15/15 通过。
- Events / Semantic Router / Monitors 与组合生命周期测试：55/55 通过。
- Codex / Claude 的 Node 测试执行：234 项，226 通过、8 失败；8 项失败均为引用 `CallId` 的测试文件无法加载，不能解读为只剩 8 个行为用例需修。
- 官方 Session / surface / chunk-rows / seq-ranges 测试：172/172 通过。
- 8 个前端在临时目录中复制当前源码、排除父目录旧 DSH 依赖、指向新官方包后类型检查失败。错误数量包含缺少类型的连锁错误，不代表独立 bug 数。
- Web tarball 安装、启动、合法认证、实际 combo 资源与浏览器检查：结果另见 `verification.json`。旧认证/旧 URL 的探测失败不计为插件故障。

| 真实安装场景 | 结果 |
| --- | --- |
| Plugin Manager 单独、Session Import 单独 | 2/2 启动与浏览器加载通过；不代表源码已适配新类型 |
| Semantic Router 单独、Monitors 单独 | 2/2 通过 |
| Events 单独、Events + Router + Monitors + 验收 fixture | 2/2 通过；fixture 的语义路由、定时 Monitor、事件回放均完成 |
| 含 Codex/Claude 的单独或组合场景 | 0/7；全部被 `CallId` 宿主导入错误阻断 |
| Workbench 单独、Workbench + Files、Workbench + Terminal | 0/3；浏览器 session context 错误 |

总计 **16 场景，6 通过、10 失败**。现有插件 tarball 与新 DSH 的启动测试不能替代历史导入、Markdown 预览、终端交互等完整功能验收。

本次没有重跑真实 Codex/Claude 模型迁移全量验收，也没有把任一编译或启动检查当成全功能兼容认证。

### 复现安装检查

Relay 自有探针 `smoke-install.mjs` 基于现有安装 verifier，只在实验目录增加合法启动 token 交换、按 boot graph 检查 combo URL、失败后继续收集结果。
它使用临时 DSH profile，不修改日常配置；打包时跳过 prepack，因为检查对象是已构建插件产物。
需要先按本文版本准备 DSH 和插件产物。任一场景失败时返回非零退出码。

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node dsh-lab/upstream-update-20260831/smoke-install.mjs
```

`--codex-only` 可只复现 Codex 启动阻断。默认关闭本次测试进程的 DSH telemetry；不调用真实模型。

## 建议的适配顺序

1. 当前已发布组合继续使用已验证的 `0.1.1-rc.2`；本次新源码保留在官方只读参考目录，不把 alpha 当作可直接替换的稳定运行环境。
2. 在插件仓库分别处理 `ToolCallId`、准备脚本和精确 peer 范围；隔离旧依赖后构建，避免假通过。
3. 迁移 Session Controller / Remote、Chat 扩展与自动导入同步，再适配 Workbench / Files / Terminal。
4. 更新 token、combo graph、contenteditable 验收工具；复测单插件、组合安装、工具审批、历史恢复、事件唤醒和断线重连。
5. 完成后再按各插件仓库的发布流程提交、发布并更新 Relay gitlink。本次只检查和记录，没有擅自实施兼容性修复或发布。

官方对比：[基线到新版本](https://github.com/deepseek-ai/deepseek-harness/compare/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e...0a53fb55bea101816fa226bb964ae2bed71c343b)。
