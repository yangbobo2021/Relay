# DSH 0.1.2-rc.1 与 Relay 兼容性验证报告

本次检查使用官方标签 `dsh-v0.1.2-rc.1`，对应提交
`a66e4702047846cdaa10c66c9d3df3951f5ea70d`。比较基线是 Relay 最近完成验收的
`dsh-v0.1.2-alpha.3` / `dd6322d604e00eec1ba5e0c8541159906a21094a`。

官方源码只被 fetch、读取和按仓库流程同步；`upstream/deepseek-harness/` 未修改源码，最终以
detached HEAD 停在当时的官方 `master` `76fda729799fe9b3848dbe2c211d4b231032b81e`
并保持干净。运行验收使用隔离临时目录安装的官方 npm `@deepseek-ai/dsh@0.1.2-rc.1`，
没有修改日常 DSH Profile；测试目标仍严格固定为 TAG `a66e470...`，不是 TAG 后的 master。

官方发布说明：<https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-rc.1>

## 结论

**兼容修改已合并并完成双通道发布。npm `latest` 和 `next` 均包含对
DSH `0.1.2-rc.1` 的适配，同时保留 `0.1.2-alpha.3` 兼容。**

**发布前候选版本已经同时通过 DSH `0.1.2-alpha.3` 和 `0.1.2-rc.1` 的全部
19 个隔离场景（合计 38/38）。因此 Relay 可以继续维护同一套双版本兼容代码，
不需要分叉成 rc.1 专用实现。相同修改现已进入正式版和预览版。**

| npm 通道 | 已发布版本 |
| --- | --- |
| `latest` | 九个 0.2 系列插件 `0.2.2`；Monitors `0.3.1`；三个 Monitor 扩展 `0.1.1` |
| `next` | 九个 0.2 系列插件 `0.2.3-rc.1`；Monitors `0.3.2-rc.1`；三个 Monitor 扩展 `0.1.2-rc.1` |

发布前的决定性阻断是 DSH 删除了 `Session.events` 数组访问器，改为显式的 `seq`、
`eventAt()`、`snapshotEvents()`、`ownEvents()` 和 `isOwnSeq()`。Relay 已发布的 `0.2.1` 代码仍在
以下路径读取 `session.events`：

- Codex 的正常对话、权限/位置恢复、有效 preset 读取与原生 Session 导入/同步；
- Claude 的正常对话、权限恢复与有效 preset 读取；
- Events 投递重试的已入队去重检查；
- Plugin Manager 的确认令牌与用户消息位置绑定。

旧版 Codex 与 Claude 的官方 Host 创建 Session 验收均实际失败，浏览器收到
`gateway/internal`，根因是插件读取 `undefined.length`。全集成场景同样失败。

作为历史基线，十个 `0.2.1` 插件的 DSH peer range 都允许 `0.1.2-rc.1`，因此包管理器不会替我们
拒绝这个已知不兼容组合。这是发布元数据风险，适配修复发布前应收紧当前发行线的支持声明，
或尽快发布经过 `rc.1` 验收的新版本。

适配前的源码验证入口也不接受新版本：Codex 的 `npm run prepare:dsh` 在 typecheck 之前即因
版本白名单只含 `alpha.2/alpha.3` 而退出。相同硬编码存在于 Codex、Claude、Events、Router、
Monitors、Workbench、Files、Terminal 和 Session Import 九个插件；Manager 的 DSH
devDependencies 则仍精确固定为 `0.1.2-alpha.3`。因此现有 `npm test` 无法进入测试主体，
更不能替代一次真正链接 `rc.1` 声明的十插件验证。

## alpha.3 到 rc.1 的上游变化

GitHub 官方比较显示两标签之间有 305 个提交、2,391 个文件变化。按本地树级 diff 的一级
目录统计，变化主要集中在 `packages/`（1,982 文件），其次是 `.agents/`（197）、
`snapshots/`（82）、`docs/`（63）、`apps/`（60）和 `scripts/`（18）。大量变化来自全仓版本号、
README、测试快照和移除没有独立观察价值的 `./invariant` 伴生入口。

与 Relay 边界直接相关的实质变化如下：

1. **Session 日志读取 API 改造。** `Session.events` 被移除；长度、单事件与数组快照分别改用
   `seq`、`eventAt()` 和 `snapshotEvents()`。这直接破坏当前 Relay 运行时代码。
2. **Session 序号强类型化。** 新增 `SessionSeq`、`SessionLogOffset`、`SessionSeqCursor` 和
   `OptionalSessionSeq`；事件身份与日志间隙不再都用普通 `number`。Session Controller 的
   `rename()`、`loadThrough()`、分页和投影相关类型随之变化。
3. **Seed 元数据拆分。** 逻辑 `SessionHeader.seedLength` 改为必填 `isSeeded`，精确切点由
   `inheritedEventCount` 随正文读取结果携带。v0 JSONL 物理 header 仍使用可选
   `seedLength`，所以磁盘格式保持字节兼容；插件直接构造/恢复 Session 的代码仍需适配新 API。
4. **投影缓存升级兼容。** `session_projcache` 增加 v3/v4/v5 跨版本读取和损坏记录
   `backup-and-skip` 恢复，降低旧 DSH_HOME 升级时的启动与标题丢失风险。
5. **会话前端扩展面变化。** Slots 增加 keyed hooks；Conversation location data 增加细粒度
   observable source 和上一物化值；Chat 节点/过程读取改为 keyed source。Composer 子 slot
   的 ownership 与渲染位置也有调整。需要用所有 Relay 客户端插件重新 typecheck 和浏览器验收。
6. **持续子代理消息统一。** `followup`/`reportFrom` 与单向 `report` 工具被统一为相邻
   parent/child 的 `sendMessage()` / `send_message({agent_id,message})`，发送可 steer 正在运行的
   最近 step；旧 report 包和相关扩展入口被删除。
7. **默认组合与内部清理。** Web PTC 默认不再暴露通用 `workflow` 工具；大量无有效独立观测的
   `./invariant` 子路径被删除。Relay 当前未直接依赖这些被删除入口，但安装组合仍需回归。

官方 `rc.1` 发布说明还汇总了自 `0.1.1-rc.2` 以来的 UI、长会话、图片、网络重连、ACP、
Web Preview、Inspector、WebFetch 和安全说明等变化；这些并不都发生在 `alpha.3 → rc.1`
这一段，不能把整份 release note 当成本次精确 diff。

## 已执行的隔离验收

直接从 npm 下载十个已发布的 Relay `0.2.1` 包并装入官方 `0.1.2-rc.1` Web Profile，执行
验证器定义的全部 16 个隔离场景：

| 场景 | 结果 | 结论边界 |
| --- | --- | --- |
| Manager only | 通过 | 只证明安装、注册、启动和客户端加载；未执行管理对话确认 |
| Session Import only | 通过 | 只证明中立导入 UI 加载；未执行 Codex/Claude 原生导入 |
| Router only | 通过 | 安装、注册、启动和客户端加载通过 |
| Monitors only | 通过 | 安装、注册、启动和客户端加载通过 |
| Event plugins | 通过 | Events + Router + Monitors 重放、路由和 timer 完成 |
| Event plugins + Codex | **失败** | 创建 Session 时读取 `undefined.length` |
| Event plugins + Claude | **失败** | 创建 Session 时读取 `undefined.length` |
| Events only | 通过 | HTTP 去重和错误请求通过；未覆盖 DSH inbox 重试去重 |
| Codex only | **失败** | 创建 Session 时读取 `undefined.length` |
| Claude only | **失败** | 创建 Session 时读取 `undefined.length` |
| Codex + Claude | **失败** | 创建 Session 时读取 `undefined.length` |
| Workbench only | 通过 | 创建/打开 Session 与 Workbench actions 挂载通过 |
| Workbench + Files | 通过 | 文件树、Markdown/源码、缩放、关闭/重开通过 |
| Workbench + Terminal | 通过 | 无 Terminal provider 时正确报告且不崩溃 |
| Codex + Terminal | **失败** | 创建 Session 时读取 `undefined.length` |
| All plugins | **失败** | 创建 Session 时读取 `undefined.length` |

结果为 **9/16 通过、7/16 失败**；九个通过项不能抵消 Codex/Claude P0 主链路失败。
此外，九个源码 linker 均实测拒绝 `0.1.2-rc.1`，根目录 `npm test` 在 Codex
`prepare:dsh` 阶段即退出，未进入测试主体。结构化证据见
[verification.json](verification.json)，上游变更摘要见
[upstream-changes.json](upstream-changes.json)。

## 修复后的双版本矩阵

候选产物增加了一个结构化 Session 读取边界：rc.1 优先使用 `snapshotEvents()` 和
`seq`，alpha.3 回退到不可变 `events` 快照。Codex 的对话、位置恢复、导入与同步，Claude
的对话与 preset 恢复，Events 的 inbox 去重，以及 Plugin Manager 的确认游标均已迁移。
Codex 持久化写入也按能力区分两套官方接口：alpha.3/rc.1 使用数值型
`inheritedEventCount` 服务 API，后续 DSH 主线使用 options 对象和写句柄。

| DSH Host | Relay 产物 | 结果 |
| --- | --- | --- |
| `0.1.2-alpha.3` / `dd6322d...` | 已发布版本的候选期制品 | **19/19 通过** |
| `0.1.2-rc.1` / `a66e470...` | 已发布版本的候选期制品 | **19/19 通过** |

补充验证：九个 linker 均接受并链接 rc.1；三个新增 Monitor 扩展均在独立仓库执行
`npm ci` 与 `verify`；Events、Router、Monitors、Time、Process、Author、GitHub、Email
及其组合共 **201/201** 项测试通过，8 个发布制品审计通过。
Manager 新增了 rc.1 `snapshotEvents()` 确认游标用例，Events 新增了 rc.1 durable retry
去重用例。Manager 的 rc.1 本地包验收通过；受控生命周期的安装、禁用、启用、更新、删除及
对应冷启动共 **10/10** 步通过，每个变更都验证了确认要求和 token 重放拒绝。结构化证据见
[dual-compatibility-verification.json](dual-compatibility-verification.json)。

Relay 根目录在精确 rc.1 TAG 声明下的聚合测试为 **477/477**；13 个独立包在发布前均
通过版本可用性、发布元数据和 `npm publish --dry-run` 检查，随后 Release 工作流成功发布
`latest` 与 `next`，并逐包验证 npm dist-tag。

此外，受控升级验收已经使用精确 alpha.3 运行时写入 Session，再由 rc.1 恢复并冷启动复核；
Session ID、业务 turns、事件前缀均保留。该矩阵仍未发起付费模型请求，也没有连接生产
GitHub/Gmail 账号，因此这些属于外部环境验收，不作为本次 API 兼容发布的阻断项。

## 适配与发布状态

1. **已完成：**将九个插件的 `prepare:dsh` 版本门禁和 Manager 的精确 DSH devDependencies 更新到
   `0.1.2-rc.1`，使源码真正解析 `rc.1` 声明，不能继续从父目录解析 `alpha.3`。
2. **已完成：**把 Relay 生产代码的 `session.events` 读取迁移到双版本兼容边界；当前生产路径
   未发现需要 Relay 自行构造的 rc.1 seed header。
3. **已完成：**十插件均以官方 rc.1 graph 完成 typecheck，四个受影响插件重新构建并通过测试。
4. **已完成：**用同一批候选 tarball 在 alpha.3 和 rc.1 各跑 19 个官方 Profile 场景；覆盖单插件、
   Codex/Claude、Events/Router/Monitors、Time/Process/Author、GitHub/Email HTTP、Workbench/Files/Terminal
   以及包含全部 15 个 Relay 插件的组合安装。
5. **已完成：**Events 持久化重试去重、Manager 确认/拒绝/令牌重放、alpha.3 Session 写入后由 rc.1
   恢复和冷启动均通过受控验收。
6. **已完成：**候选版本号、锁文件和制品 SHA-256 已生成；13 个候选包的版本可用性、发布元数据和
   `npm publish --dry-run` 均已通过。
7. **已完成：**各仓库兼容 PR 按基础依赖到上层插件的顺序合并；13 个正式版本与
   13 个预览版本均已打 Tag、通过 Release 工作流并发布到 npm。

当前可以声明 npm 正式版和预览版均支持 alpha.3 与 rc.1。付费 Codex/Claude 模型请求和
生产 GitHub/Gmail 账号联调仍属于外部环境验收，不影响本次 DSH API 兼容发布结论。
