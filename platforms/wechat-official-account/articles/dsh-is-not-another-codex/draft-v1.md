# DSH 不是另一个 Codex：别再只问谁能替代谁

DeepSeek Harness 能不能替代 Codex、Claude Code 或 Cursor？

如果问题指的是“现在装好就开始写代码，谁的完成度更高”，我的答案很直接：普通用户优先使用 Codex、Claude Code 或 Cursor，不必为了统一先增加一层系统复杂度。

但如果因此认为 DSH 没有价值，也容易错过它真正想解决的问题。

这些产品本来就不完全处在同一层。

## 先把四类产品放回各自的位置

Codex 和 Claude Code 的核心，是成熟的编码 Agent 执行后端。它们负责理解代码、修改文件、运行命令、处理审批并维持自己的模型上下文。

Cursor 首先是围绕代码编辑器构建的产品。它把 AI 能力放进日常编辑、检索和修改流程里。

DeepSeek Harness（DSH）更接近一个开源 Agent Harness：它管理 Agent、Workspace、Session、工具和界面，并把扩展能力交给插件系统。

所以“谁更强”其实混在了一起：有人在比较编码 Agent，有人在比较编辑器，还有人在比较一个开放宿主。

## 如果只想马上把代码写完

直接使用成熟工具通常更省事。

Codex、Claude Code 和 Cursor 已经把模型、代码检索、命令执行、文件修改、审批和产品界面组合好了。普通用户不需要先理解 DSH 的 Profile、Bundle、Cordis 服务或插件兼容版本，就能开始任务。

DSH 当前仍处于开发者预览阶段，安装、兼容性和生态都在快速变化。尤其当你想要完整 IDE 体验时，DSH 加 Files 插件也不能等同于 Cursor：Files 主要是目录浏览和文本预览，不是完整编辑器。

如果需求只是“今天把这个功能写完”，先选成熟工具，不要为了架构上的统一给自己增加维护工作。

## DSH 真正不同的地方

DSH 对我有吸引力的，不是它要再做一个“最强编码 Agent”，而是它可以成为开放的会话和插件宿主。

我可以保留未经修改的官方 DSH，再独立安装 Codex 或 Claude Code 插件。新建 Session 时直接选择执行后端：

![官方 DSH 中选择 Standard、Codex 或 Claude Code](assets/01-backend-menu.jpg)

选择 Codex 后，并不是让 DSH 模拟一段 OpenAI API 对话。

这个 Session 会绑定真实的 Codex App Server Thread。模型上下文、工具状态和执行仍由 Codex 负责；DSH 负责项目归属、会话入口和界面。

Claude Code 插件也是同样的思路：它延续自己的 Claude Session，而不是把 Claude 伪装成 DSH 的普通模型回复。

更准确的关系是：

- DSH 可以运行自己的 Agent；
- 也可以通过插件接入 Codex、Claude Code 等会话后端；
- 用户按任务选择后端，而不是要求 DSH 在所有任务上击败它们。

## 接入以后，今天已经能得到什么

目前已经可以做到：

- 在同一个 Workspace 下管理 DSH、Codex 和 Claude Code 会话；
- 每段 Codex 或 Claude Code 会话继续自己的原生上下文；
- 导入当前 Workspace 已有的 Codex Thread；
- 可选安装 Files 和 Terminal，把项目文件与真实 Shell 放到对话旁边；
- 每个插件独立安装，不需要修改 DSH 官方仓库。

![Codex 会话和当前 Workspace 的 Files 视图](assets/02-files-view.png)

但还没有的能力也要说清楚：

- 三个 Agent 目前不会自动协商和分工；
- DSH 对话不会自动把上下文交接给 Codex 或 Claude Code；
- Files 不是完整代码编辑器；
- DSH 处于开发者预览阶段，插件需要持续跟踪上游兼容性；
- 使用 Codex 和 Claude Code，仍然需要它们各自正常的认证和使用资格。

开放并不等于开箱即用，也不等于所有能力已经完成。

## 真正值得关注的是插件边界

我们最初也修改过 DSH Fork，把终端、文件浏览和会话后端直接放进核心代码。

这种方式短期很快，但官方一更新，合并冲突就会持续出现。用户也只能安装整份 Fork，无法在官方版本上按需选择功能。

后来这些能力被拆成独立插件：Codex、Claude Code、Workbench、Files、Terminal。插件之间通过 DSH 的服务与视图注册机制交互，而不是直接引用彼此内部代码。

这样做的长期价值，不只是“少解决几次 Git 冲突”：

- 官方 DSH 可以保持不改；
- 每个插件可以独立安装和发布；
- 同类插件可以复用公共宿主能力；
- 将来把插件移到独立仓库时，不需要重新切断大量内部依赖。

对想开发 Agent 产品的人，这种边界可能比某一次模型排行榜更值得研究。

## 该怎么选

可以用一个很简单的判断：

如果主要目标是马上完成编码任务，直接选择 Codex、Claude Code 或 Cursor。

如果你只需要一个 Agent，也没有跨工具管理问题，不必安装额外 Harness。

如果你正在研究自定义 Agent、插件机制、不同会话后端，或者确实遇到了同一项目对话散落的问题，再考虑官方 DSH 和对应插件。

因此，我的结论不是“DSH 已经超过了 Codex、Claude Code 和 Cursor”。

它解决的是另一个层面的问题：让成熟执行后端可以进入一个开放的会话和插件体系，同时保留各自的上下文与工具能力。

官方 DSH：
https://github.com/deepseek-ai/deepseek-harness

Codex 插件：
https://github.com/yangbobo2021/relay-dsh-plugin-codex

Claude Code 插件：
https://github.com/yangbobo2021/relay-dsh-plugin-claude

完整插件和后续协作研究：
https://github.com/yangbobo2021/Relay

