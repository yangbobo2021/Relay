# DeepSeek Harness 可以媲美 Claude Code、Codex、Cursor 吗？

> 知乎问题：<https://www.zhihu.com/question/2074768400707073334>
>
> 发布说明：从下方正文开始粘贴；图片使用文中标注的真实本地素材。

先说结论：如果“媲美”指开箱即用的编码体验和产品成熟度，我现在不会建议小白用 DeepSeek Harness 替代 Claude Code、Codex 或 Cursor。

但它们本来也不完全是同一类东西。

Codex 和 Claude Code 的核心是成熟的编码 Agent 执行后端；Cursor 首先是围绕代码编辑器构建的产品；DeepSeek Harness（DSH）更接近一个开源 Agent Harness：它管理 Agent、会话、工具和界面，并把扩展能力交给插件系统。

DSH 官方 README 也明确写着两件事：everything is a plugin；当前仍是 developer preview，后续可能出现不兼容修改。这两个特点同时决定了它的优点和风险。

## 如果只想马上把代码写完

直接使用 Codex、Claude Code 或 Cursor 通常更省事。

它们已经把模型、代码检索、命令执行、文件修改、审批和产品界面组合好。小白不需要先理解 DSH Profile、Bundle、Cordis 服务或插件兼容版本，就能开始一个编码任务。

DSH 虽然也有自己的标准 Agent 模式，但如果拿它当前的开发者预览版本去和成熟产品逐项比较，安装、兼容性和生态都还在快速变化。尤其是希望获得完整 IDE 编辑体验时，DSH 加 Files 插件也不能等同于 Cursor：Files 当前主要是目录浏览和文本预览，不是完整编辑器。

## DSH 真正不同的地方

DSH 对我有吸引力的不是“再做一个最强编码 Agent”，而是它可以成为一个开放的会话和插件宿主。

我可以保留未经修改的官方 DSH，然后独立安装 Codex 或 Claude Code 插件。新建 Session 时选择后端：

![官方 DSH 中选择 Standard、Codex 或 Claude Code](../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

选择 Codex 后，并不是让 DSH 模拟一段 OpenAI API 对话。这个 Session 会绑定真实的 Codex App Server Thread，模型上下文、工具状态和执行仍由 Codex 负责；DSH 负责项目归属、会话入口和用户界面。

Claude Code 插件也是类似思路：它延续自己的 Claude Session，而不是把 Claude 伪装成 DSH 的普通模型回复。

所以一种更准确的关系是：

- DSH 可以直接运行自己的 Agent；
- 也可以通过插件把 Codex、Claude Code 作为不同会话后端；
- 用户按任务选择后端，而不是要求 DSH 在所有任务上击败它们。

## 接入以后能得到什么

现在已经可以做到：

- 同一个 Workspace 下管理 DSH、Codex 和 Claude Code 会话；
- 每段 Codex/Claude 会话继续自己的原生上下文；
- 导入当前 Workspace 已有的 Codex Thread；
- 可选安装 Files 和 Terminal，把项目文件与真实 Shell 放到对话旁边；
- 每个插件独立安装，不需要修改 DSH 官方仓库。

![Codex 会话和当前 Workspace 的 Files 视图](../media/dsh-plugin-suite-live.png)

但也要把还没有的能力说清楚：

- 三个 Agent 目前不会自动协商和分工；
- DSH 对话不会自动把上下文交接给 Codex 或 Claude；
- Files 不是完整代码编辑器；
- DSH 仍处于开发者预览，插件需要跟踪上游兼容性；
- 使用 Codex 和 Claude 仍然需要它们各自正常的认证和使用资格。

## 小白应该怎么选

我的建议很简单。

如果主要目标是马上完成编码任务，先从 Codex、Claude Code 或 Cursor 中选一个直接使用，不必为了“统一”先增加系统复杂度。

如果你对开源 Agent Harness、插件机制、自定义工具或会话后端感兴趣，可以单独尝试官方 DSH。等你确实遇到“同一个项目的对话散在多个工具”“希望在 DSH 中继续 Codex Thread”这类问题，再安装对应插件。

如果你正在开发 Agent 产品，而不是只想使用一个编码工具，DSH 的开放插件边界可能比某一次模型排行更值得研究。代价是要接受开发者预览阶段的变化，并自己做好兼容测试。

因此我的答案不是“DSH 已经超过了 Codex、Claude Code 和 Cursor”，而是：它试图解决另一个层面的问题，并且可以把这些成熟执行后端接进自己的会话与插件体系。对普通用户，成熟工具优先；对想研究开放 Harness 和多后端组合的人，DSH 值得关注。

官方 DSH：<https://github.com/deepseek-ai/deepseek-harness>

Codex 插件：<https://github.com/yangbobo2021/relay-dsh-plugin-codex>

Claude Code 插件：<https://github.com/yangbobo2021/relay-dsh-plugin-claude>

完整插件和后续协作研究：<https://github.com/yangbobo2021/Relay>
