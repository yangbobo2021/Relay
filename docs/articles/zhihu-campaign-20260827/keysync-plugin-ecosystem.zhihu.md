# 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？

“一切皆插件”最容易被说成一个很厉害的技术概念，但我更关心它能不能变成普通用户每天都能感受到的东西。

对用户来说，插件架构真正的价值不是知道 Agent Loop、Session Log 或文件系统也能替换，而是遇到一个需求时，可以直接补上对应能力，不需要等官方发新版，也不需要改 DSH 源码。

我自己在实际使用中遇到的需求很具体：

- 每次找插件、输入命令安装太麻烦，所以做了 Plugin Manager；
- DSH 有些复杂任务仍然不如成熟 Agent，所以做了 Codex 和 Claude Code 集成；
- 不想离开 DSH 再切终端和文件管理器，所以做了 Terminal、Files 和 Workbench；
- 长任务期间会离开电脑，所以用 KeySync 做桌面入口和远程接力。

这几类需求恰好说明了“一切皆插件”的实际意义：不是把所有能力都塞进核心，而是在需要的时候组合出自己的工作台。

Plugin Manager 解决的是插件生态越大以后最先出现的问题：发现、安装和排错。我的目标是让用户直接在 DSH 对话里说“帮我找一个能浏览文件的插件”或“安装 Codex 集成”，先看到准备执行的计划，再完成安装，而不是到处复制命令。通过 KeySync 一键安装 DSH 时，这个插件管理入口会一起提供。

Codex 和 Claude Code 插件解决的是能力切换。我并不认为 DSH 发布后，所有任务都应该只交给 DSH。有些大型代码修改、复杂审查或已有工作流，我仍然会选择成熟 Agent。比较舒服的做法，是留在 DSH 的工作入口里，根据任务切换后端，同时保留项目现场。

Terminal 和 Files 则补回开发过程中最常看的两块信息：命令执行到哪里、文件到底改了什么。这样 DSH 不只是一个对话框，而更接近完整工作台。

![DSH 中的文件浏览面板](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/06-files-panel.png)

![DSH 中的终端面板](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/07-terminal-panel.png)

KeySync 解决的是插件之外的入口问题。它把 DSH 做成普通用户容易理解的客户端形态：不用另装 Node，一键安装，按钮启动和停止；任务跑起来以后，还能从手机或另一台电脑回到同一个会话。

![KeySync Client 管理 DSH](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-desktop/keysync-client-dsh-running-stop-open.png)

所以我对“一切皆插件”的判断是：架构方向很有价值，但生态成败不取决于插件数量。真正重要的是插件是否解决真实需求、能否被发现、安装失败时能否处理、多个插件组合后是否仍然稳定。插件从“开发者能写”走到“普通用户敢装”，才算形成生态。

上面提到的插件都是我自己因为真实需要开发、并且每天在用的。代码和安装包都放在公开仓库：

- Plugin Manager：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-manager) / [npm](https://www.npmjs.com/package/relay-dsh-plugin-manager)
- Codex：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-codex) / [npm](https://www.npmjs.com/package/relay-dsh-plugin-codex)
- Claude Code：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-claude) / [npm](https://www.npmjs.com/package/relay-dsh-plugin-claude)
- Terminal：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-terminal) / [npm](https://www.npmjs.com/package/relay-dsh-plugin-terminal)
- Files：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-files) / [npm](https://www.npmjs.com/package/relay-dsh-plugin-files)
- Workbench：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) / [npm](https://www.npmjs.com/package/relay-dsh-plugin-workbench)

KeySync 不是开源项目，也不是 DSH 官方产品。客户端和远程访问目前完全免费。

KeySync 下载：<https://sublang.ai/keysync/download>

DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
