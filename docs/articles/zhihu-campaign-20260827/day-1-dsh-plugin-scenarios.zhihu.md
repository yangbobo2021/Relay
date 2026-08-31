# Day 1: DeepSeek Harness 有什么好用的插件？

> 知乎问题：<https://www.zhihu.com/question/2071617281214378127>
>
> 推荐首图：`docs/media/dsh-plugin-suite-live.png`
>
> 发布建议：这篇主打“按场景选插件”，不要写成插件排行榜。图片控制在 2 张：后端选择菜单、Files/Terminal 工作台。

如果只按“最火插件榜”去装 DeepSeek Harness 插件，很容易把 DSH 装成一个很热闹、但不知道每天怎么用的工具箱。

我更建议按工作流选。第一波真正值得试的，不是十几个花哨插件，而是五类很具体的场景。

## 1. 不知道该装什么：先装插件管理器

DSH 插件生态起来以后，第一个痛点不是“插件不够多”，而是普通用户很难判断：

- 我应该搜什么关键词？
- 这个包是不是给 DSH 用的？
- 安装会改哪些东西？
- 装完是不是要重启？

所以我会先推荐 Plugin Manager。它对应的包名是 `relay-dsh-plugin-manager`，但普通用户不需要先记包名，先记它解决什么问题就够了。

它的作用不是再做一个插件市场，而是让你在 DSH 对话里直接说需求。比如“找一个能浏览工作区文件的插件”“安装 Codex 插件”“列出当前插件状态”。它会先给出安装计划，涉及变更时再让你确认，不会因为一句模糊的话就直接动手改配置。

如果你是通过 KeySync 一键安装 DSH，Plugin Manager 已经作为默认入口内置进去，后面找插件会轻松很多。

## 2. 原来习惯 Codex，现在想试 DSH

这类用户不要一上来问“DSH 能不能替代 Codex”。更现实的问题是：我已经习惯 Codex 写代码了，但想看看 DSH 的项目入口、会话列表和插件系统，能不能把工作组织得更好。

这时可以试 Codex 插件。它对应的包名是 `relay-dsh-plugin-codex`。

它不是让 DSH 假装成 Codex，也不是把 Codex 的历史复制一份。更准确地说，是在 DSH 里新建或继续一个 Codex 会话：代码执行、工具状态、上下文仍由 Codex 负责，DSH 负责把这段会话放进同一个项目入口里。

适合的场景是：

- 代码任务仍交给 Codex；
- 项目入口、会话列表、工作区选择交给 DSH；
- 想在一个地方看到 DSH 原生会话、Codex 会话和后面的 Claude 审查会话。

![官方 DSH 中选择 Standard、Codex 或 Claude Code](../../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

## 3. 原来习惯 Claude Code，现在想用 DSH 管理项目

Claude Code 用户的逻辑类似。

如果你喜欢 Claude Code 做方案审查、文档分析、边界检查，可以试 Claude Code 插件。它对应的包名是 `relay-dsh-plugin-claude`。它把 Claude Code 作为 DSH 里的一种会话模式，而不是把 Claude 的回答塞进普通 DSH 对话里。

我比较喜欢的用法是：

- DSH 原生会话：讨论需求和拆任务；
- Codex 会话：读代码、改文件、跑测试；
- Claude Code 会话：从另一个角度做审查。

三段会话可以在同一个项目下并列存在，但不会自动混用记忆。这个边界反而重要：出了问题，你知道是哪一个 Agent 做的。

## 4. 已经习惯 Codex 开发，但不想离开 App 找文件和终端

这时重点不是再加一个聊天后端，而是把“项目现场”放到对话旁边。

可以装这三个：

- `relay-dsh-plugin-workbench`
- `relay-dsh-plugin-files`
- `relay-dsh-plugin-terminal`

Files 负责右侧文件树和文本预览。Terminal 负责底部终端面板。Workbench 是放这些面板的地方。

如果你已经习惯 Codex 开发，这个组合的价值很直接：Agent 提到某个文件时，不用切到另一个窗口找；需要确认命令时，也不用离开当前 DSH 界面。

![DSH 中的 Codex 会话、Files 和 Terminal 工作台](../../media/dsh-plugin-suite-live.png)

这里也要说清楚边界：Files 不是完整 IDE，Terminal 需要一个能真正执行命令的后端。当前这组插件里，Codex 插件可以提供真实终端能力。

## 5. 长任务用户：多设备远程接力

如果你的 AI 任务经常跑很久，真正麻烦的不是装哪个模型，而是人离开工位以后怎么办。

这时要看的不是 DSH 插件，而是 KeySync。

KeySync 的定位是：在你的工作电脑上安装并运行官方 DSH，然后让你从手机、平板或另一台电脑回到这台机器上的原 DSH 会话。项目、文件、终端和 Agent 仍在工作电脑上运行，不是搬到云端。

这对长任务很有用：

- Mac 上开 Codex 会话查代码；
- 路上用手机看进展；
- 到家后用另一台电脑继续原会话；
- 不需要重新描述“刚才做到哪一步”。

## 我会怎么装

如果你是第一次试，我不建议一口气装一堆。

我的顺序是：

1. 用 KeySync 或官方方式先把 DSH 跑起来。
2. 用 Plugin Manager 解决“插件怎么找、怎么装”的问题。
3. 原来用 Codex，就先装 Codex 插件。
4. 需要审查，再装 Claude Code 插件。
5. 开始高频做项目后，再加 Files 和 Terminal。

这样 DSH 不会一下子变复杂。每多装一个插件，都对应一个明确的工作痛点。

相关链接：

- Relay DSH 插件目录：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md>
- KeySync 下载：<https://sublang.ai/keysync/dl-dy>
- DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
