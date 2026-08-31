# 全部插件适配 DSH 0.1.2-alpha.2

代码适配及部分本地自动化验收已完成，全功能回归尚未完成；管理器严格安装检查存在下述发布时间限制。目标是官方 `0.1.2-alpha.2`，commit
[`0a53fb55`](https://github.com/deepseek-ai/deepseek-harness/commit/0a53fb55bea101816fa226bb964ae2bed71c343b)。
用户早先提及的 `0.1.0-internal.2` 不是此次核实的官方版本；本次按“所有插件适配新版 DSH”覆盖当前全部 **10 个**独立插件。

代码最初在各插件的 `codex/dsh-0.1.2-alpha.2` 分支适配；当前提交及合并记录见
[CHECKPOINT.zh.md](CHECKPOINT.zh.md)。本次适配尚未发布。
各插件版本号保持不变，没有调整 npm `latest` / `next`。
官方 DSH 源码保持干净；修改均在插件仓库和 Relay 自有验证脚本中。
原有文章、验证目录等未纳入本次修改。

> 覆盖审查澄清：通过项不代表全部旧功能已端到端验收。第一批补充真实终端，第二批补充 Claude 真实后端及升级并修复提问回归，第三批在登录恢复后补充 Codex 真实核心链路及升级。Codex 提问在旧/新 Default 模式均未通过。详见[总清单](FUNCTIONAL-REGRESSION.zh.md)、[第一批](FUNCTIONAL-BATCH-1.zh.md)、[第二批](FUNCTIONAL-BATCH-2.zh.md)及[第三批](FUNCTIONAL-BATCH-3.zh.md)。

## 向后兼容发布阻断

反向实测确认：旧 DSH `0.1.1-rc.2` 可以安装新 Codex 候选，但 Host 随后因缺少
`ToolCallId` 导出而启动失败。当前包声明不是有效拒装保护；新版不能按普通补丁覆盖旧版通道。
须先完成版本线/依赖隔离、安装与加载保护、反向矩阵和 CI 门槛；自动拦截尚未实现。
见[风险及证据](BACKWARD-COMPATIBILITY.zh.md)。目前没有发布或修改 npm 通道。

## 最新验收状态（第四批）

已按用户要求继续其他场景，详见[第四批报告](FUNCTIONAL-BATCH-4.zh.md)及
[集中问题清单](FINAL-ISSUES.zh.md)。新增通过：Codex 图片/附件/fork/导入续聊、
双后端隔离、Claude 附件存取、文件交互和路径边界、多终端清理、真实定时器跨重启唤醒/去重、
管理器真实计划拒绝及启禁、推荐页；事件子系统确定性检查 55/55。

仍未通过：Codex 原生提问、Claude 识图及 fork 上下文、Workbench 刷新尺寸偏好。
其中已有能力限制和未证明是升级引入的问题已分别标注。
管理器公开来源测试已执行，原始 1 passed / 1 failed；完整生命周期被已发布旧 Codex
包不兼容阻挡。冻结安装复测仍被 24 小时策略阻挡。下文初始“未运行”记录仅指历史批次。
本批没有修改插件实现或发布，不能称所有原功能已经正常。

## 实际修复

- 所有插件：更新官方依赖范围和锁文件；CI 固定到新提交。9 个插件的开发链接脚本读取官方完整依赖图和 `exports.types`，移除废弃 Runtime 链接；插件管理器使用独立 npm 依赖和新版 CLI fixture。
- Codex / Claude：`CallId` 迁移为 `ToolCallId`，恢复 Host 加载；Chat、Conversation、Session 各自使用新版公共入口。
- Codex / Claude 模型选择：通过 `modelDirectories` 调用公共目录，读取 `projectionValues.agentPreset`；处理过期请求和卸载。Claude 不再因模型投影更新反复选择或重置已选模型。
- Codex：支持打包后的文本、推理和工具参数增量；保留逻辑序号、首个可见 token 的位置，防止重复合并。遇到未覆盖的工具内容仍保留官方渲染。
- Codex：当前会话同步改用 Session 列表；Markdown 使用新版 labels；官方 compact 模式会折叠整行时撤销自定义接管，使最终答案和原生工具行保持可见。
- Workbench：使用独立 client-store，并用官方 `SessionProvider` 包住 Details 插槽，修复缺失会话上下文的运行时错误。
- Files：更新 Markdown 预览契约。Terminal、Session Import、Events 更新客户端入口和服务依赖；Router、Monitors 保持业务算法，通过新版宿主验证。
- Manager：保留已发布的推荐界面，迁移确认流程测试至 scoped user-questions waterfall；继续要求明确的人类批准。
- Relay 验证脚本：使用新版启动令牌换取登录 Cookie，依据 boot graph 获取 combo 资源，并使用新版可编辑输入框选择器。测试不绕过认证。
- 第二批 Claude 修复：提问时省略未填写的 `detail` / option `description`，避免 `undefined` 被新版 Remote 无损 JSON 校验拒绝；保留提供的字符串并补充传输契约回归测试。

## 验证结果

下表为初始适配批次。第二批新增一个 Claude 回归测试，其最新验证为 133 项；
未把重复执行的批次累计为功能覆盖数。

| 插件 | 通过测试数 | 类型/语法检查 | 构建 |
| --- | ---: | --- | --- |
| codex | 368 | 通过 | 通过 |
| claude | 132 | 通过 | 通过 |
| session-import | 19 | 通过 | 通过 |
| workbench | 10 | 通过 | 通过 |
| files | 7 | 通过 | 通过 |
| terminal | 12 | 通过 | 通过 |
| manager | 94 | 通过 | 通过 |
| events | 25 | 通过 | 通过 |
| semantic-router | 10 | 通过 | 通过 |
| monitors | 9 | 通过 | 通过 |

合计 **686 项插件测试通过**，另有 **5 项跨插件契约测试通过**。
插件管理器的 **2 项公开网络来源 opt-in 测试未运行**，不计入通过数；它们不是付费模型对话测试。

- 10 个插件均在 Relay 之外的隔离目录执行 `npm ci --ignore-scripts`、类型/语法检查、测试、构建，通过；已跟踪构建产物与工作区构建逐字节一致。
- 官方宿主打包安装 **16/16** 场景通过，包括所有 10 个插件同时加载；零浏览器加载错误。最后的 Claude 防重复选择修改又复查了单装、双后端和全部插件组合，均通过。
- 工作台浏览器交互 **5/5** 场景通过，覆盖面板、空态、工作区文件内容预览及终端视图。
- 后续第一批将浏览器回归扩至 **6/6**，补充 Markdown 预览、真实 Codex 终端命令/resize/Ctrl-C/面板恢复/exit；管理器受控五步生命周期及五次真实冷启动通过。详见第一批记录，未重复计入 686 项测试。
- 第二批 Claude 真实 SDK **8/8**、CLI fallback **2/2**、含旧版对照的会话升级流程 **4/4**；修复后 **133** 项测试、类型检查/构建、**3/3** 组安装加载和 **5/5** 跨插件契约通过。详见第二批记录，CLI 与 SDK 的通过范围分别记录。
- 第三批 Codex 主回归 **6/7**、模型/重启 **3/3**、升级对照 **2/4**；提问未通过的真实记录保留，旧版同样未显示卡片。登录阻碍已解除，已有相关测试 **32/32**、契约 **5/5**。插件候选包未改变，未重新累计初始测试数。
- Events 真实宿主验收覆盖事件去重、语义路由、恢复投递和持久计时唤醒。
- Manager 使用官方 checkout 及 npm `@deepseek-ai/dsh@0.1.2-alpha.2` fixture 的打包验收均通过；推荐区仍是 2 张卡片和 2 条完整安装提示，没有直接执行按钮。
- `git diff --check` 通过，官方参考 checkout 未修改。

**发布前仍需复测：插件管理器 fixture 的冻结安装。** 最新官方包尚未满足
pnpm 的 24 小时 `minimumReleaseAge` 策略，原有 CI 的 pnpm `11.7.0` 和
本地 `11.19.0` 均拒绝冻结安装。此前已安装的 npm fixture 功能验收通过，但这
不等于严格安装检查通过。已移除 pnpm 自动生成的发布时间例外，没有保留例外文件，
也没有关闭或降低全局保护。保留原 CI 的 pnpm 版本；待依赖通过冷却期后重跑：

```sh
cd integrations/dsh-plugin-manager
pnpm install --dir test/fixtures/dsh-runtime --frozen-lockfile --ignore-scripts
DSH_CLI_PATH="$PWD/test/fixtures/dsh-runtime/node_modules/@deepseek-ai/dsh/lib/bin.js" npm run acceptance
```


机器可读记录：[adaptation-verification.json](adaptation-verification.json)。
各插件 `docs/dsh-0.1.2-alpha.2.md` 记录各自兼容范围及独立验证命令。

## 复现

先按各插件说明构建，再从 Relay 根目录执行：

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/path/to/chrome' node scripts/verify-dsh-official-install.mjs
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/path/to/chrome' node scripts/verify-dsh-ui-e2e.mjs
node --test scripts/test/dsh-independent-backends.test.mjs
```

宿主安装脚本测试预先构建的 tarball，不在打包阶段重建。
可用 `DSH_INSTALL_SCENARIOS=claude-only,codex-and-claude,all-plugins` 复查指定场景。
第二、三批已执行 Claude 和 Codex 真实模型对话，但覆盖范围见各批记录；Windows/Linux CI
仍未执行。不能把部分通过结果扩展为全部功能或其他平台已通过。
