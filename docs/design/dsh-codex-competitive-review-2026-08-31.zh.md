# DSH Codex 插件对比与改进建议

调研日期：2026-08-31。范围：GitHub 搜索、14 个代表性项目的 README 与源码静态检查、Relay 本地实现检查。没有安装或运行竞品，没有进行相同账号、模型、任务条件下的性能对跑，因此不对完成质量、速度、成本或生产稳定性排名。

## 结论

Relay 应继续定位为“DSH 中可持续工作的原生 Codex 会话后端”。我们在持久 Thread、真实 Fork、原生历史导入、交互与工具桥接方面具有明确能力；订阅 Provider 项目在登录、额度、设置和新手使用流程上更有借鉴价值。近期应优先补齐协议防护与隐私默认值、登录和额度界面、App Server 故障恢复，而非重新实现 Codex agent loop。

## 基线与证据边界

- 本地插件：`integrations/codex`，提交 `90b3038ed4eca4cf43a4df2049180f8f1f134811`，版本 `0.1.6-rc.1`；GitHub HEAD 与其一致。未跟踪的迁移验证目录不作为已发布功能证据。
- npm 查询时：`relay-dsh-plugin-codex@latest = 0.1.5`，`@next = 0.1.6-rc.1`。下面“我们已有”的实现结论以该候选版本为准，不能全部套用到稳定版。
- 官方 DSH npm 查询时：`latest/next = 0.1.1-rc.2`，`alpha = 0.1.2-alpha.2`。
- 我们 README 与 CI 的已验证 DSH 基线：`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。本次未同步、更改或重新验证上游。
- 搜索使用 `dsh codex`、`deepseek-harness codex`，并按仓库名缩小范围。结果包括主题、桌宠、导入器和反向委派等；所选项目不构成穷尽清单。
- 版本来自调研提交的 package.json，不代表对应版本必然已经发布。星数不作为质量证据。

## 先区分产品路线

| 路线 | 谁负责模型上下文与执行 | 代表 | 对 Relay 的意义 |
| --- | --- | --- | --- |
| 订阅 Provider | DSH；插件接入订阅模型服务 | Codex Connect、Yan-Zero、WSL043、Subscriptions、Codex Switch | 借鉴登录、额度与配置体验；不能等同于恢复原有 Codex Thread |
| 原生会话后端 | Codex 持久 Thread；DSH 负责用户交互 | Relay、LyleMi | 直接比较持久性、权限映射、进程管理与兼容性 |
| App Server 模型适配器 | 各项目不同，有持久重放、临时 Thread 或 DSH 历史重建 | SoftSpark、wss534857356、wingoo、necokeine | 不能仅凭“使用 App Server”就认为上下文语义相同 |
| Codex 风格工具与提示词 | DSH | shuind、xiaosu19 | 可研究工具契约和任务评测，但不是原生 Codex 运行时 |
| 子代理／分发整合 | 单次子任务或固定版本整合环境 | hecoococ、chenzezhai-sketch | 属于相邻能力，不作为主会话后端直接替代品 |

## 主要项目对比

### Codex Connect / Yan-Zero

[franksong2702/dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect) 与 [Yan-Zero/dsh-codex](https://github.com/Yan-Zero/dsh-codex) 提供 DSH 内的 OAuth、额度和 Fast 控件。Connect 还提供登录取消与恢复、代理诊断、`doctor`、精确插件/DSH 版本兼容记录和更新提示。这些流程比我们要求先在官方客户端登录、再查看 Advanced 连接状态更完整。

代价是插件需维护订阅传输、凭据与刷新逻辑；DSH 拥有会话执行，不能视为原有 Codex 会话的原样延续。我们应借鉴界面与诊断流程，通过官方 App Server 实现同类体验。相关项目存在继承关系，不应把相似功能算作多份独立验证。

### WSL043

[WSL043/dsh-codex-subscription](https://github.com/WSL043/dsh-codex-subscription) 的优势是额度、重置确认、脱敏支持报告，以及图片原图下载、区域标注和继续编辑流程。它区分不同额度桶，也说明订阅失败不会静默转到其他付费路由。

它同样是订阅 Provider，不保留我们的原生 Thread 连续性。其全局搜索设置会作用于所有模型，我们更适合保持会话与插件作用域明确；媒体体验可通过独立文件／图片组件组合，不必塞进 Codex 核心插件。

### Subscriptions / Codex Switch

[V1ki/dsh-plugin-subscriptions](https://github.com/V1ki/dsh-plugin-subscriptions) 将多家订阅入口集中在设置中，支持按会话的速度选择和媒体工具；适合已有 DSH 工作流、希望选择不同订阅模型的用户。它需要维护多家认证和接口，能力广度不等于完整保留各厂商原生运行时。

[ZChenW/dsh-codex-switch](https://github.com/ZChenW/dsh-codex-switch) 专注多账号、额度窗口、手动／自动切换及诊断。调研快照主要包含构建产物，README 中的开发脚本不都有对应源码文件，因此对其实现细节和可复现性保持保留。Relay 可以考虑明确隔离的账号配置，但不建议默认在任务途中自动切号，也不把规避服务限额作为目标。

### LyleMi：最接近我们的架构竞品

[LyleMi/dsh-codex-app-server](https://github.com/LyleMi/dsh-codex-app-server) 用 Codex 替代 AgentFactory，有持久绑定、DSH 动态工具、审批、原生压缩与流式执行记录。值得学习的源码包括：

- [watchdog](https://github.com/LyleMi/dsh-codex-app-server/blob/ac589ba2c34d924c528b2804c97af828fb261904/src/wire/watchdog.ts)：按活跃状态检测空闲超时。
- [process](https://github.com/LyleMi/dsh-codex-app-server/blob/ac589ba2c34d924c528b2804c97af828fb261904/src/process.ts)：有界诊断和完整进程组的分级回收。
- [protocol check](https://github.com/LyleMi/dsh-codex-app-server/blob/ac589ba2c34d924c528b2804c97af828fb261904/scripts/check-codex-protocol.mjs)：核对生成协议与方法集合。

它的安装会将 profile 变成专用 Codex profile，关闭原 Agent loop 和普通模型适配器；Fork 使用新 Thread 加最多 64 KiB 的文本／推理投影，不是 Codex 原生 Thread Fork。相比之下，我们可与 Standard/Claude 并存，且使用 `thread/fork` 和严格绑定，更符合多后端项目工作流。其 README 仍标注 beta 和较早 DSH 基线，不能直接推断当前全部环境可用。

### SoftSpark：协议防护值得学习

[softspark/dsh-codex](https://github.com/softspark/dsh-codex) 的传输实现有运行时消息校验、8 MiB 报文上限、64 KiB stderr 上限、写入背压和秘密字段脱敏；默认不启用实验性 DSH 工具桥。见 [transport](https://github.com/softspark/dsh-codex/blob/6b8b13e8b1aafb692e98ad10a8e5a6af9900907f/src/app-server/transport.ts)、[validation](https://github.com/softspark/dsh-codex/blob/6b8b13e8b1aafb692e98ad10a8e5a6af9900907f/src/app-server/validation.ts)、[redaction](https://github.com/softspark/dsh-codex/blob/6b8b13e8b1aafb692e98ad10a8e5a6af9900907f/src/app-server/redaction.ts)。

它的工具桥为 opt-in、仅文本，README 明确不支持工具桥状态跨进程重启重放；我们在工具、图片、问题交互和原生会话导入上的覆盖更广。不能仅以它声称的测试数判断优劣，我们已经有自己的 CI、验收矩阵和 provenance。

### 其他有代表性的实现

- [wss534857356/dsh-plugin-codex](https://github.com/wss534857356/dsh-plugin-codex)：执行轨迹、缓存 token、图片持久化、图片字节预算和新版 DSH 适配值得参考。Thread 是可丢弃的会话缓存，冷启动依赖 DSH 日志重建且不恢复 Codex rollout；与我们的连续原生上下文目标不同。
- [wingoo/codex-plugin-dsh](https://github.com/wingoo/codex-plugin-dsh)：App Server Provider，具备图片输入、生成图片回写与 DSH 工具往返；仍需用户预装 CLI，文档中的实机验证基线较早。
- [necokeine/dsh-codex-relay](https://github.com/necokeine/dsh-codex-relay)：实现范围清楚，固定运行时并映射 DSH 审批。每次调用创建临时 Thread，终结后一次性输出答案；不投影流式文本、usage 或完整执行轨迹，不适合替代我们的长期会话后端。
- [shuind/dsh-codex-harness](https://github.com/shuind/dsh-codex-harness)、[xiaosu19/dsh-codex-mode](https://github.com/xiaosu19/dsh-codex-mode)：可以研究提示词、工具契约和公开基准的方法，但它们主要在 DSH 内重建 Codex 风格体验。其性能数字没有与 Relay 使用相同测试条件，不据此推断更快或更省。

## 我们应该保留的优势

1. 一条 DSH Session 对应一条 Codex Thread；resume/fork 失败不静默新建替代上下文。
2. `thread/fork` 保留原生分支语义；原生历史导入保留绑定和工作目录边界。
3. DSH 原生审批、问题、流式执行、图片及动态工具桥接；原生工具不被 DSH 重复执行。
4. 插件可独立安装，Codex、Claude、Standard 可并存；Events/Monitors/Files/Terminal 保持独立。
5. 固定打包官方 `@openai/codex@0.149.0`，无需依赖全局 PATH；已有三平台运行时测试与 npm provenance。

这些是候选版本的能力，不代表完整 Codex Desktop 等价。README 已记录空命令输出、macOS locale、旧 Thread 的输出能力差异以及外部客户端 writer 占用等限制。

## 改进顺序与验收目标

| 优先级 | 改进 | 当前证据 | 建议验收 |
| --- | --- | --- | --- |
| P0，下次发布前 | 协议校验与资源上限 | `app-server-client.mjs` 直接 JSON.parse 后访问字段；readline 未见单帧大小上限，写入未等待背压 | null/数组/错误字段/截断/超长帧均受控失败；内存有界；所有 pending 请求得到明确结算 |
| P0，下次发布前 | 诊断脱敏与隐私默认值 | `session-runtime.mjs:addDiagnostic` 只 trim 并按条数截断；启动含 `--analytics-default-enabled` | 诊断入口脱敏并按字节限额；导出只含允许字段；移除强制默认开启分析的参数或提供清楚说明并遵循用户设置 |
| P1，用户收益高 | 官方登录、额度、Fast 与健康状态卡 | 当前仅初始化 `account/read`，UI 主要展示连接状态；native service tier 已保留，但没有对应的完整配置体验 | 区分进程连接与账号可用；登录可取消／恢复；按服务端返回额度桶展示；只在支持时显示 Fast；敏感状态不进入通用日志 |
| P1，长期任务基础 | 有界故障恢复与进程树回收 | App Server 退出会标记失败；client.close 发 SIGTERM 后最多等 1 秒，未见升级强杀与完整进程树确认 | 区分正常审批／工具等待和卡死；恢复同一 Thread；不自动重放有副作用的 turn；宿主退出确认进程树清理；不误杀其他任务 |
| P1，降低升级事故 | 协议版本矩阵与隔离安装 canary | 已有固定 DSH 基线、三平台运行时 CI 和 release provenance | 增加生成协议差异检查；固定稳定组合+下一版 canary；实测安装、重启、审批、图片、取消、导入与 Fork；失败不推进 dist-tag |
| P2，提升操作体验 | 执行展示与图片编辑交接 | 已有过程视图和图片投影；原生命令输出仍有已知缺口 | 首段输出、退出码、失败原因、文件 diff 清楚；原图与预览区分；继续编辑保留原图引用且不自动发送 |
| P2，建立差异 | 长期任务的组合验收与演示 | Relay 已有独立 Events/Monitors 方向 | 等待外部事件→路由到原 Session/Thread→继续任务，重启不丢绑定、不重复执行；不把等待系统塞入 Codex 插件 |

官方 App Server 文档已列出 `account/login/start`、`account/login/cancel`、`account/login/completed`、`account/updated`、`account/rateLimits/read` 和 `account/rateLimits/updated`。因此账户界面不必另写订阅 OAuth 或读取 auth.json。实现前仍应对固定的 0.149.0 运行时生成协议并验证可用方法，不能把最新文档等同于所有旧版本都支持。来源：[OpenAI App Server auth endpoints](https://learn.chatgpt.com/docs/app-server#api-overview-1)。

重置额度、登出和切换账号是有后果的账户操作，不能因新增状态卡而自动执行。初期先实现只读状态与用户发起的登录，账号池放后续独立评估。

### 本次本地小测试

没有启动 Codex、登录账号、发送模型请求或读取真实秘密，只直接调用两个函数：

- 对 `CodexAppServerClient.prototype.handleLine` 输入字符串 `null`：得到未捕获 `TypeError`。
- 对 `CodexSessionRuntime.prototype.addDiagnostic` 输入仅用于测试的模拟 Bearer token：诊断数组仍保留该模拟 token。

这确认了函数边界的防护缺口，不证明存在实际凭据泄露，也不证明正常官方 App Server 会发送 null 帧。

## 不建议优先做的事

- 不为追赶订阅插件而放弃官方 App Server，重写私有订阅传输或原生 agent loop。
- 不把 DSH 展示历史等同于原生 Thread 的完整上下文；不以自动新建 Thread 掩盖恢复失败。
- 不默认自动切号、自动消耗重置额度、自动重试未知结果的外部写操作。
- 不以“测试数量更多”“用了 Codex 模型”“用了 App Server”推导质量或上下文等价。
- 不再把已经完成的图片、真实 Fork、导入、跨平台 CI 或 provenance 列为从零建设项。

## 调研快照

| 项目 | package 版本 | Git commit |
| --- | --- | --- |
| franksong2702/dsh-codex-connect | 0.1.0-alpha.4.22 | f3ad8c4af00111d029c499e2166ec63f2a981ddc |
| Yan-Zero/dsh-codex | 0.2.5 | e3e54e206f7c829503c7e6eed378643ba0416792 |
| V1ki/dsh-plugin-subscriptions | 0.5.3 | 1aee4b7885567bdb11124117d2e0f7fb2efa01c5 |
| WSL043/dsh-codex-subscription | 1.11.3 | d873b1cb0a6f49219d08002de3d65d7ff21459b8 |
| ZChenW/dsh-codex-switch | 0.1.0-alpha.8 | 7cde17417e3b2a194eb033b3e419d50ddff17190 |
| LyleMi/dsh-codex-app-server | 0.1.0-beta.3 | ac589ba2c34d924c528b2804c97af828fb261904 |
| softspark/dsh-codex | 1.0.0 | 6b8b13e8b1aafb692e98ad10a8e5a6af9900907f |
| wingoo/codex-plugin-dsh | 0.1.0 | 79fe7503390d641680bad8efade52782a3c31ced |
| shuind/dsh-codex-harness | 0.2.1 | 5b37b724bb9cf3361f3be645e523cee0d837bff9 |
| xiaosu19/dsh-codex-mode | 0.7.3 | 1a4466065fb81e006d4b5f1c3708ef3691ecb05d |
| wss534857356/dsh-plugin-codex | 0.1.20 | 9db7c07514b92b179ecbc49e24d18ef2fa9b076d |
| necokeine/dsh-codex-relay | 0.1.2 | 4de6c5bdff0cbe4dd8afd23c94ccc3d28deac2ff |
| hecoococ/dsh-codex-connect | 0.1.0-rc.8 | 1179308f01119ae4ccde5ad0ba68806b3e9de9aa |
| chenzezhai-sketch/dsh-codex-harness | 整合仓库，无根 package 版本 | 0f8e467fcfa5aa7378adef84f6ffbb64015c86a7 |

本次只新增调研文档，未修改产品代码、插件版本、账户、DSH profile 或上游源码。
