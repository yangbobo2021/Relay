# Day 3: 怎么看 DSH 一切皆插件？

> 知乎问题：<https://www.zhihu.com/question/2071348486667237276>
>
> 推荐首图：`docs/media/dsh-plugin-suite-live.png`
>
> 发布建议：这篇不要写成安装教程。主线是“为什么不改 DSH 核心也能扩展出新工作流”。少用架构名词，多用用户能感知的结果。

“一切皆插件”最容易被误解成：插件很多、列表很长、能折腾很多玩法。

但我觉得 DeepSeek Harness 这件事真正值得看的，不是插件数量，而是它让用户和开发者有机会不改核心，也能扩展出新的工作方式。

这点比“又多了一个 AI 编码工具”更重要。

## 为什么不要轻易 Fork DSH

开源项目刚出来时，很多人的第一反应是：缺什么功能，我直接改源码。

短期看，这很快。长期看，会变成一个麻烦：

- 上游一更新，你要处理合并冲突；
- 你改过的界面和内部接口可能失效；
- 用户想安装你的能力，可能要换成你维护的定制版；
- 生态里每个人都维护一份 Fork，最后互相不兼容。

如果 DSH 真想成为 Agent 运行时，它最重要的能力不是让所有人改核心，而是让大家在核心之外扩展能力。

## 一个具体例子：把 Codex 和 Claude Code 接进来

我现在更看重的是这个结果：

在官方 DSH 里，不改 DSH 源码，也可以加入 Codex 和 Claude Code 两种会话后端。

这句话听起来有点技术，但翻译成用户语言就是：

- 你原来习惯 Codex 写代码，不必为了试 DSH 就丢掉 Codex；
- 你原来习惯 Claude Code 做审查，也不必把 Claude 的工作方式塞进普通对话；
- DSH 可以成为项目入口，具体任务仍然交给不同 Agent。

![官方 DSH 中选择 Standard、Codex 或 Claude Code](../../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

这里的重点不是“谁替代谁”。重点是 DSH 可以把不同 Agent 放在同一个项目入口下，同时保留各自边界。

## 文件和终端也可以不绑死在一个产品里

另一个例子是 Workbench、Files 和 Terminal。

很多 Agent 产品的问题是：聊天在一个窗口，文件在另一个窗口，终端又在另一个窗口。Agent 说“我改了 README”，你还要切出去找。

在 DSH 里，右侧文件浏览和底部终端可以通过插件加进来。Files 只负责看文件，Terminal 只负责终端面板，Workbench 只负责承载这些区域。

![DSH 中的 Codex 会话、Files 和 Terminal 工作台](../../media/dsh-plugin-suite-live.png)

这个边界很朴素，但很有价值：每个能力只做自己的事，不需要互相偷对方内部实现。

## 插件管理也应该更像对话，而不是查表

插件一多，普通用户就会遇到另一个问题：我怎么知道该装哪个？

我现在更倾向于把插件管理放回对话里做。`relay-dsh-plugin-manager` 这类插件不是一个花哨插件市场，而是让你在 DSH 对话里说需求，然后给出插件搜索结果、安装计划和确认步骤。

比如你可以说“找一个工作区文件浏览插件”。它不会立刻乱装，而是先告诉你准备装什么、从哪里装、可能需要什么操作。

如果用户是通过 KeySync 一键安装 DSH，Plugin Manager 会内置进去。这样普通用户第一次进入 DSH 后，不需要先学一堆命令。

## 所以我怎么看“一切皆插件”

我不觉得它的最大意义是“插件数量会不会破千”。

真正重要的是三件事：

1. 能不能不改核心就扩展能力。
2. 能不能让不同 Agent、文件、终端、管理工具各守边界。
3. 能不能让普通用户按需求逐步加能力，而不是一开始就面对复杂配置。

当然，DSH 仍然是预览阶段，插件兼容性必须认真验证。发布插件时固定官方 DSH 版本、保留真实安装录像和验收记录，是很有必要的。这个阶段最怕“看起来能跑，换个环境就坏”。

所以我的判断是：DSH 现在未必是最省心的普通用户工具，但它在 Agent 运行时这条路上很值得关注。它不是简单做一个 Claude Code 或 Codex 平替，而是在尝试回答另一个问题：未来 AI 工作入口，能不能由一个开放插件体系来承载？

相关链接：

- DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
- Relay DSH 插件目录：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md>
- 不改 DSH 核心的插件安装说明：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/articles/no-fork-dsh-plugins.zh.md>
