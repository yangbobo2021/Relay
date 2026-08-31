# Events / Semantic Router / Monitors 交付验收

日期：2026-08-30。交付版本：三个插件均为 `0.1.0`。

## 2026-08-31 公开 internal 发布补充

三个插件已公开发布 npm 内部测试通道 `0.1.0-internal.2`：

| 插件 | npm | 发布提交 |
| --- | --- | --- |
| Events | [`relay-dsh-plugin-events@internal`](https://www.npmjs.com/package/relay-dsh-plugin-events/v/0.1.0-internal.2) | `266b8e9c30e56cdb63d41bce6313a5f6dc671571` |
| Semantic Router | [`relay-dsh-plugin-semantic-router@internal`](https://www.npmjs.com/package/relay-dsh-plugin-semantic-router/v/0.1.0-internal.2) | `15875b16c6e66b70b47ddc934f5578710391a13c` |
| Monitors | [`relay-dsh-plugin-monitors@internal`](https://www.npmjs.com/package/relay-dsh-plugin-monitors/v/0.1.0-internal.2) | `787919e5719290574d6a3208b4dbf28eaf0f675f` |

这是公开可下载的内部集成测试包，不是 `next` 预览版或正式稳定版，不提供
兼容性承诺。安装时必须显式使用 `@internal` 或完整版本：

```bash
dsh plugin --profile web add --save-exact \
  relay-dsh-plugin-events@internal \
  relay-dsh-plugin-semantic-router@internal \
  relay-dsh-plugin-monitors@internal
```

npm 在三个全新包首次发布时自动增加了 `latest -> 0.1.0-internal.1`；注册表拒绝
删除该首次 `latest` 标签并返回 HTTP 400。该标签不代表 Relay 将其声明为稳定版；
当前内部测试通道是 `internal -> 0.1.0-internal.2`。测试者必须显式安装
`@internal`，不能依赖裸包名。

发布前，三个仓库的 main CI 均针对官方 DSH 提交
`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` 通过。发布后又在全新临时 DSH
Profile 中直接从 npm 安装三个 `@internal` 包；DSH 锁定的三个版本均为
`0.1.0-internal.2`，Host 配置全部成功合成。

## 交付边界

| 独立仓库 | 提交 | 职责 |
| --- | --- | --- |
| [Events](https://github.com/yangbobo2021/relay-dsh-plugin-events) | `c60c0e6e61298483189d5148c994f83019fef209` | Wait/Event/Delivery/Monitor 持久化、投递、入口、管理 UI、公开契约 |
| [Semantic Router](https://github.com/yangbobo2021/relay-dsh-plugin-semantic-router) | `a90d70400e29220d2789b4dee61f65d5484e5653` | 通过 DSH LLM 做无工具的结构化路由；不持有持久化或投递实现 |
| [Monitors](https://github.com/yangbobo2021/relay-dsh-plugin-monitors) | `af93b8d038410725f2cc5c8639ea0b2728c25ead` | 定时器、可信观察器、确定性检测、租约调度、重试与重新激活 |

每个仓库均包含 SPEC、验收场景、测试复查记录、独立构建和 CI。
Relay 根仓保留组合配置、规格、跨插件测试和合成验收 fixture；原
`packages/{runtime,event-router,monitor-runtime,event-runtime-plugin,plugin-sdk,dsh-plugin-contracts}`、
旧 `integrations/deepseek-harness` 产品代码、旧 worker 和对应重复实验已移出。
这些删除可从迁移前 Git 提交恢复。用户其他未提交文章、演示文件、工作区和
Plugin Manager 修改未纳入本次交付。

## 本次修复及回归证据

- 构建：解析官方 DSH 的实际声明导出，消除根工作区 npm 副本与官方源码类型
  brand 冲突；没有关闭类型检查或修改官方 DSH。
- Events：同一 Session 多个非排他 Wait 合并投递；恢复路由提供者的审计名称；
  flush 成功即确认持久 inbox 入队，不等整个模型回合结束；重试复用消息 ID。
- Monitors：Observer 身份写入/读出持久 manifest；停止时取消检查并释放租约，
  不扣失败次数；同一旧 trigger 再次出现不重复投递，也不把重新激活的 Monitor 误暂停。
- Router：给模型明确输出结构；每次调用最多 60 秒，1–3 次尝试；卸载取消且不重试。
- 生命周期：真实 Cordis 中覆盖依赖迟到、卸载、重新启用、恢复默认路由，
  以及仍存活 Agent 的插件工具移除。
- 独立分发：修正“从 GitHub main 直接安装”的不实指引。源码不跟踪 `lib/`；
  2026-08-30 本次验收点仅交付包含构建产物的 tarball，当时尚未发布 npm。

## 已执行验收

| 层次 | 结果与证据 |
| --- | --- |
| 插件自测 | Events 25、Router 10、Monitors 9 项全部通过，各自 `npm run verify` 通过 |
| 全仓回归 | `npm test` 的全仓阶段 421 项全部通过；其中跨插件组合 10 项、Cordis 生命周期 1 项 |
| 独立源码 | 三个仓库从当前提交克隆到无 Relay 父工作区的临时目录，各自 `npm ci --ignore-scripts` 与 `npm run verify` 通过 |
| 独立包 | `npm run test:package:plugins`：三个 tarball 在干净目录安装、导入公开入口通过；没有私有根运行时依赖 |
| 官方源码环境 | DSH `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`，Node 25.5.0；源码工作区验收前后干净 |
| KeySync 正式发行环境 | KeySync 安装的官方 DSH `0.1.0-rc.8` 程序及配套 Node `22.23.2`；只使用新的临时 `DSH_HOME` 和 SQLite |
| 两环境安装矩阵 | Events-only、Router-only、Monitors-only、三插件、三插件+Codex、三插件+Claude，均安装、启动、加载真实浏览器页面成功 |
| 真实会话重放 | 使用合成 DSH LLM adapter，1 次语义路由、1 次定时器触发，共 2 条 Relay 消息进入同一个既有 DSH Session；重复 Event 不重复投递；定时器绕过 Router |
| 真实 HTTP | 两环境均通过重复事件身份复用、未匹配事件不创建 Delivery、错误方法 405、无效 JSON 400 |
| 管理页面 | KeySync 正式程序的隔离配置中，检查刷新、Check now、打开原会话、Keep、Confirm cancel、取消后空状态；1280×720 无横向溢出，无浏览器错误 |

页面验收保留本地合成截图于 `.artifacts/event-plugins-20260830/`。
三个独立仓库对应提交的 GitHub CI 均已成功完成：
[Events](https://github.com/yangbobo2021/relay-dsh-plugin-events/actions/runs/33315566526)、
[Semantic Router](https://github.com/yangbobo2021/relay-dsh-plugin-semantic-router/actions/runs/33315571881)、
[Monitors](https://github.com/yangbobo2021/relay-dsh-plugin-monitors/actions/runs/33315576990)。
测试模型移除后原会话显示“模型不可用”属于预期：没有替用户添加真实模型凭据。
Codex 组合的 pnpm peer 提示为 `lucide-react` 缺少 npm 层 React peer；实际 DSH
浏览器模块由宿主提供且加载通过。该提示不是这三个插件的启动失败。

场景与代码对应：

- `integrations/events/docs/acceptance-scenarios.md`：EVT-001–017。
- `integrations/semantic-router/docs/acceptance-scenarios.md`：RTR-001–015。
- `integrations/monitors/docs/acceptance-scenarios.md`：MON-001–018。
- `scripts/test/event-plugin-composition.test.mjs`：真实 SQLite 的基线原子性、
  失败升级、租约竞争、周期重新激活、重复键、关闭、重启恢复。
- `scripts/test/event-plugin-lifecycle.test.mjs`：真实 Cordis 生命周期。
- `scripts/verify-dsh-official-install.mjs --events-only` 与
  `fixtures/dsh-event-acceptance/`：正式 DSH tarball 安装和真实 Agent/inbox 重放。

## 安装交付包

本机包目录：`.artifacts/event-plugins-20260830/packages/`。进入该目录后，针对
需要安装的 DSH profile 执行（先停止目标 DSH，且明确其 `DSH_HOME`）：

```bash
dsh plugin --profile web add \
  ./relay-dsh-plugin-events-0.1.0.tgz \
  ./relay-dsh-plugin-semantic-router-0.1.0.tgz \
  ./relay-dsh-plugin-monitors-0.1.0.tgz
```

只要外部事件入口可单装 Events；需要定时器则同时安装 Monitors。
Router 需要配置一个已在 DSH 注册的 provider/model；未配置时保持未激活，
Events 使用精确事件类型匹配。未安装或更改用户正在使用的 KeySync profile。

SHA-256：

```text
bc7ed62b462d6c4af3c24c12f6770122f72da2873ee3b379654d3cd5588e6a89  relay-dsh-plugin-events-0.1.0.tgz
5e40e02d04d5987e2b691c2a8855235c26dd1fe13d4de12a048409caf6dd44c7  relay-dsh-plugin-semantic-router-0.1.0.tgz
51954da435b559c3900790a71d5a99e10a9d8a143554b0af1eb7fd7a5da9e1f9  relay-dsh-plugin-monitors-0.1.0.tgz
```

## 未扩大或冒充完成的范围

- 没有付费真实模型业务质量测评；重放验证的是 DSH 模型协议、路由结构与投递链路。
- 没有邮件、通知、CI 等专用连接器，也没有面向真实外部服务的签名校验。
- Monitor v0.1 是一次性定时器、可信 provider、字段变化/未见条目检测与显式
  周期重新激活；不包含任意生成代码、任意 shell/browser/network 权限或日历解析。
- `escalate` 保存决策但不负责发通知。生产凭据、真实日志、用户会话未进入仓库。
- 2026-08-30 本次验收点尚无 npm 发布；2026-08-31 的公开 internal 发布见文首
  补充。没有替用户安装到正式使用环境。
