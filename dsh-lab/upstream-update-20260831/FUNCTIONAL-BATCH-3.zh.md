# 第三批：Codex 重新登录后的真实回归

2026-08-31。官方 DSH `0.1.2-alpha.2`，提交
`0a53fb55bea101816fa226bb964ae2bed71c343b`。
用户重新登录后，Codex 的真实回复成功，第二批的认证阻碍已解除。
本批只修改验收驱动与记录，未修改插件实现、版本号或 npm dist-tag，未发布。

## 通过的真实链路

| 场景 | 判据与结果 |
| --- | --- |
| 真实对话 | `gpt-5.6-sol` / low 返回合成标记，答案在浏览器可见，创建后台 Thread 绑定 |
| 原生文件工具 | 读取 `input.json`，正确计算总和 10 并写入 `result.json`；输入不变，工具活动持久化，完成回复可见 |
| 审批允许 | 真实 DSH 卡片“允许一次”；回答前目标文件不存在，回答后内容准确 |
| 审批拒绝 | 真实卡片“拒绝”；目标文件始终不存在，模型未换方法重试 |
| 中断及恢复 | 子进程写入 PID 后点击真实 Stop 按钮；12 秒内确认进程退出，无延迟写入，不依赖驱动强制清理；下一回合正常回复 |
| 刷新、重启与记忆 | 历史仍可见；Host 重启后不调用工具即可回忆随机标记，Codex Thread 绑定不变 |
| 模型及推理档 | UI 从 Sol 切换 Terra，再选择 Medium，通过输入框提交；持久请求记录为 `gpt-5.6-terra` / medium，回复及当前选择可见，绑定不变 |
| 旧会话原地升级 | 官方 npm DSH `0.1.1-rc.2` + 已发布 Codex `0.1.6-rc.1` 创建会话，再在同一个隔离 Home 升级；旧用户/助手消息逐项相同且不重复，Thread 绑定不变，续聊回忆标记成功 |

按实际运行记录统计，**主回归 6/7 通过；模型/重启运行 3/3；升级对照运行 2/4**。
后两组包含重复的基本对话/重启检查，不能累加为不同功能覆盖数。
未通过的三条记录都是下述提问用例，失败记录没有删除或改为通过。
三组运行的浏览器 `pageerror` 数均为 0；这不等于抓取了所有网络错误。

补跑现有 Host 服务、Session Runtime 和模型选择测试 **32/32**，跨插件契约 **5/5**。
插件包与此前候选的 SHA-256 相同，没有重新统计或声称重跑了初始全部 368 项测试。

## 提问用例的实际限制

新版真实请求未显示卡片，模型明确报告 `request_user_input` 在 Default 模式下不可用。
旧 DSH + 已发布旧插件执行同一场景也没有卡片，只输出普通文本选项；升级后再试仍失败。
已发布 tarball 与当前 `session-runtime.mjs` 均使用 `collaborationMode.mode: "default"`。

因此，**现有证据不支持把它归为本次 DSH 升级引入的回归**；这是当前运行模式下的
已有可达性限制。桥接的模拟测试不能代替真实卡片验收，该场景仍记为 `failed`，
不宣称 Codex 结构化提问可用，也没有为了通过测试绕过模式限制或偷偷切换为 Plan。
若要保证这项能力，后续须明确支持的模式和入口，再独立实现/验收。

## 环境与证据

- macOS / arm64，Node `25.5.0`；插件使用 bundled `codex-cli 0.149.0`。
- 浏览器为本机已有 Chromium Headless Shell `149.0.7827.55`。
  首次尝试系统 Chrome 时卡在 `browser.newContext`，没有启动 DSH 或发出模型请求；
  只终止了本次驱动创建的浏览器进程，改用已有 Headless Shell 后成功。
  驱动新增初始化阶段输出和上下文创建超时，保留首轮环境失败记录。
- 独立 DSH Home、Profile、合成工作区和后台绑定，沿用现有登录，不复制凭据、不改日常会话。
- 候选 Codex 包 SHA-256：
  `e25b9541172c4b2fa48c8c18c1d0097bf9398b80d6ec748f8bdaf0e5c8c37058`。
- [机器可读记录](functional-batch-3.json)保存各包散列、版本、判据、失败分类及外部证据路径。
  完整原始合成历史和截图仅保留在 `/tmp/relay-alpha2-codex-*`，不提交完整请求上下文。

复现时使用新产物目录，先构建插件，再执行；命令会消耗真实模型用量：

```sh
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=codex \
DSH_BACKEND_TASKS=smoke,tools,approval,cancel,question,model,memory \
DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-alpha2-codex-new-run \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell \
  node scripts/verify-dsh-backend-e2e.mjs

# 旧版对照和升级；提问未通过会导致脚本非零退出，这是保留的真实结果。
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=codex \
DSH_BACKEND_TASKS=smoke,question \
DSH_BASELINE_BIN=/absolute/path/to/old-dsh/lib/bin.js \
DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-alpha2-codex-upgrade-new-run \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell \
  node scripts/verify-dsh-backend-e2e.mjs
```

## 仍未解除的发布门槛

Codex 图片/附件、原生会话选择性导入与 fork、DSH 动态工具与子代理、Skills/MCP/Hooks、
跨会话/工作区隔离、外部历史同步及故障恢复未由本批完整验收。
升级只验证本批合成文本会话，不代表旧附件及全部历史格式均兼容。
其他插件的完整交互、事件系统恢复、严格冻结安装复测和 Windows/Linux CI 仍按
[总清单](FUNCTIONAL-REGRESSION.zh.md)执行；本批结果不构成全部 10 插件的发布批准。
