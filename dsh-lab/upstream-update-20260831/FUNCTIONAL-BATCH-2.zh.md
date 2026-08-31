# 第二批：真实后端、交互和旧会话升级

2026-08-31。目标为官方 DSH `0.1.2-alpha.2`，提交
`0a53fb55bea101816fa226bb964ae2bed71c343b`。本批完成了 Claude 的关键真实链路，
修复一处提问兼容问题；**Codex 真实模型验收因登录失效受阻，全部插件尚未达到发布门槛**。
全部操作使用隔离 Profile、合成工作区和新测试会话；未升级日常 DSH，未发布任何包。

后续更新：[第三批](FUNCTIONAL-BATCH-3.zh.md)已确认用户重新登录后 Codex 真实调用恢复，
并补充核心链路和旧会话升级。本文件的 blocked 是第二批当时状态，保留作历史证据。

## 发现并修复的回归

Claude `AskUserQuestion` 的原桥接代码把可选 `detail` / option `description`
写为 `undefined`。新版 Remote 事件要求数据可无损 JSON 序列化，因此拒绝请求：
`api gateway: Remote event request is not lossless JSON data`。模型收到工具错误，
浏览器没有问题卡片。模型回合本身仍可能显示 completed，不能用回合完成代替功能通过。

修改仅位于 Claude 插件：未填写的可选字段省略，已填写字符串（包括空字符串）保持不变。
没有放宽官方校验，没有绕过用户确认，也没有更改官方源码。
新增无损 JSON 与可选字段保留的回归测试，并在原服务组合测试中加入传输契约检查。

同类提问已实测：**旧 DSH + 已发布旧插件通过；新 DSH + 修复前候选失败；
新 DSH + 修复后候选通过**。失败证据保留，不能被随后通过的结果抹去。

## 实测结果

| 范围 | 结果及判据 |
| --- | --- |
| Claude SDK 基本对话 | 真实回复可见，DSH Session 绑定真实 Claude Session |
| 原生文件工具 | 读取合成输入、写出正确 JSON；输入文件不变，工具活动持久化，结果在 UI 可见 |
| 审批允许 | 真实卡片显示；点击“允许一次”前目标不存在，之后文件内容准确 |
| 审批拒绝 | 真实卡片点击“拒绝”；目标文件始终不存在，模型停止该操作 |
| 中断及恢复 | 点击真实“停止”按钮；已记录 PID 的子进程退出、无延迟写入；下一回合正常回复。测试驱动清理不计为成功取消 |
| 提问 | 真实 AskUserQuestion→DSH 卡片→选择 BETA→提交→模型收到选择并回复；修复后通过 |
| 模型与输入框 | 通过 UI 从 Sonnet 切换 Haiku，输入框发送；实际 DSH 请求记录为 haiku，回答可见，绑定未替换，选择未被自动改回 |
| 刷新、重启和记忆 | 历史可见；Host 重启后不读取文件即可回忆先前随机标记；同一后台会话绑定保留 |
| Claude CLI fallback | 单独验证真实回复及重启后续聊/记忆，2/2 通过；不是 SDK 审批或导入的通过证据 |
| 旧版升级 | 官方 npm DSH 0.1.1-rc.2 + 已发布 Claude 0.1.5 创建会话并完成提问，再在同一隔离 Home 升级到新 DSH/候选包；旧消息完整且不重复、后台绑定不变、续聊记忆及新版提问通过 |

修复后 SDK 主回归 **8/8**；CLI fallback **2/2**；带旧版提问对照的升级流程
**4/4**（包括旧环境中的检查，不是四个新版独立功能）。各运行浏览器异常记录为空。
另外通过 Claude `npm run verify`：**130 项 Node 测试 + 3 项组件测试**、类型检查及构建；
修复后重新打包，Claude 单装、Codex+Claude、全部 10 插件加载 **3/3**，跨插件契约 **5/5**。

运行平台 macOS / arm64，Node 25.5.0。SDK 解析为 `0.3.251`；CLI fallback 为
`2.1.251`。模型使用现有账号/服务配置中的 `sonnet`、`haiku` 别名，本批不是模型效果或
服务商对比。CLI 模型目录未声明推理档，按其目录不传 `low`，不能当作相同推理配置的对比。

## Codex 阻碍

真实模型请求返回 `CODEX_TURN_FAILED`：刷新令牌已被使用，要求重新登录。
这是环境/认证阻碍，状态为 **blocked**；不能据此判定插件回归，也不能计为通过。
已请求用户重新登录插件所用的本机 Codex CLI，没有自动退出其他任务的登录。
重新登录后应在同一目标 DSH 提交上补跑多轮、工具、审批允许/拒绝、提问、中断、
历史/附件、fork、模型切换及原地升级。

## 证据与复现

[机器可读汇总](functional-batch-2.json)保留候选包散列、运行版本、逐项结果和
失败/阻碍分类。原始合成历史与截图位于 `/tmp/relay-alpha2-*` 对应运行目录；
不将完整请求上下文、账号配置或凭据复制入仓库。

从 Relay 根目录执行（会消耗真实模型用量，需已登录）：

```sh
# SDK 全部关键场景
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=claude \
DSH_BACKEND_TASKS=smoke,tools,approval,cancel,question,model,memory \
DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-alpha2-claude-new-run \
  node scripts/verify-dsh-backend-e2e.mjs

# CLI fallback 独立验证
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=claude DSH_CLAUDE_BACKEND=cli \
DSH_BACKEND_TASKS=smoke,memory DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-alpha2-cli-new-run \
  node scripts/verify-dsh-backend-e2e.mjs

# 先在另一个临时目录安装官方 npm DSH 0.1.1-rc.2，将其 bin.js 传入。
# 驱动另建隔离 Home；不接收、不修改用户日常 Profile。
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=claude \
DSH_BASELINE_BIN=/absolute/path/to/old-dsh/lib/bin.js \
DSH_BACKEND_TASKS=smoke,question DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-alpha2-upgrade-new-run \
  node scripts/verify-dsh-backend-e2e.mjs
```

构建后的 tarball 是验收输入；脚本不代替各插件构建。可通过
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定浏览器。产物目录必须是新路径，驱动拒绝
覆盖已有目录；运行目录应分别保留。本批修复前的驱动接线错误（空会话侧栏、版本元数据导出、CLI 推理档）
已纠正；它们没有被算作产品回归或通过结果。

## 仍未覆盖

- Claude 图片输入/输出及旧附件升级、原生会话选择性导入、fork、跨 Session/Workspace
  隔离、Skills/MCP/Hooks、DSH 动态工具、长期故障恢复、合成敏感信息泄露验证。
- 旧版升级仅覆盖本批合成会话与提问活动；不代表所有历史格式、附件、Wait/Monitor 或
  大型历史均已验收，也没有进行回退演练。
- 管理器完整会话确认/公开来源生命周期，Workbench/Files 全交互，以及
  Events/Router/Monitors 的真实恢复与组合场景，仍按总清单逐项补齐。
- Windows/Linux 的本轮验收、严格冻结安装复测及所有必测项仍是发布门槛。
  通过前不发布这批适配包，不宣称“所有原功能正常”。
