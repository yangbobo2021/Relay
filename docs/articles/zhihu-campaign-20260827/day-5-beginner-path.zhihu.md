# Day 5: 完全没有编程基础的人能上手 DeepSeek Harness 吗？

> 知乎问题：<https://www.zhihu.com/question/2071518584656995815>
>
> 推荐首图：`docs/media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg`
>
> 发布建议：这篇要诚实，不要承诺“零基础秒会”。主线是“能试，但要走低门槛路径”。避免出现 Bundle、Profile、Cordis 等词。

能试，但我不建议完全没有编程基础的人一上来就自己查命令、装插件、改配置。

DeepSeek Harness 现在仍然更偏开发者预览。它很有潜力，但对零基础用户最不友好的地方也很明显：概念多、插件多、安装路径多，一旦报错，很难判断是网络、版本、插件还是本地环境的问题。

所以我的建议不是“别碰”，而是换一条上手路径。

## 零基础用户不要从插件生态开始

很多教程一上来就讲插件、命令、配置文件。对开发者还好，对零基础用户很容易变成三连问：

- 我到底要装哪个？
- 这个命令应该在哪里运行？
- 装完以后我怎么知道成功了？

如果你没有编程基础，第一步应该是把 DSH 跑起来，并且知道自己下一步要做什么，而不是把几十个插件名看一遍。

这也是 KeySync 比较适合零基础用户的原因。它提供的是官方 DSH 的一键安装入口，并且让你后续可以从手机、平板或另一台电脑回到工作电脑上的原会话。

注意，这里不是说 KeySync 会让你自动懂 DSH。它解决的是第一道门槛：少碰命令行，先进入可用界面。

## 第二步：用对话找插件，而不是自己查包名

进到 DSH 后，也不要急着到处搜插件清单。

如果是 KeySync 一键安装的 DSH，Plugin Manager 已经内置。你可以直接在对话里说：

- 找一个能浏览工作区文件的插件
- 我想在 DSH 里使用 Codex
- 列出当前已经安装的插件

它会先展示计划，再等你确认。这个流程对零基础用户很重要，因为“先告诉我要发生什么”比“复制一条长命令然后祈祷成功”友好得多。

## 第三步：按自己原来的习惯接 Agent

零基础用户上手 DSH，不一定要先学它所有能力。

如果你原来已经习惯 Codex，就先接 Codex。你仍然让 Codex 处理代码任务，只是从 DSH 的项目入口进入。

如果你原来习惯 Claude Code，就先接 Claude Code。它适合做方案审查、文档分析、补充另一种视角。

如果你还没有固定工具，那就先用 DSH 原生对话做简单任务：整理需求、列计划、总结项目资料。等你明确需要写代码或审查，再加对应插件。

![官方 DSH 中选择 Standard、Codex 或 Claude Code](../../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

## 第四步：只在需要时打开文件和终端

很多人看到 Files、Terminal 会觉得“这是不是程序员专用”。

其实可以简单理解：

- Files：在右侧看项目文件；
- Terminal：在底部运行命令；
- Workbench：放这些面板的地方。

如果你只是聊天，不需要它们。如果你已经开始让 Codex 改项目文件，它们就很有用。Agent 说改了哪个文件，你可以直接看；它说某个命令通过了，你可以在同一个界面核对。

![DSH 中的 Codex 会话、Files 和 Terminal 工作台](../../media/dsh-plugin-suite-live.png)

## 第五步：长任务再考虑多设备接力

如果你只是偶尔问问题，不需要远程接力。

但如果你会让 Agent 跑长任务，比如分析一批文件、检查一个项目、跑测试、整理文档，那么人离开电脑后就会遇到问题。

KeySync 的远程入口适合这个场景：任务仍在你的工作电脑上，手机或另一台电脑只是回到原来的 DSH 会话。不要重新开一个新对话，继续原来的那段。

## 我给零基础用户的路线

最稳的顺序是：

1. 用 KeySync 或官方方式安装 DSH。
2. 先用 DSH 原生对话做一个简单项目。
3. 用 Plugin Manager 查看和安装插件。
4. 原来习惯 Codex，就加 Codex 插件。
5. 需要审查，再加 Claude Code 插件。
6. 高频做项目后，再加 Files 和 Terminal。
7. 有长任务，再用 KeySync 多设备继续原会话。

这条路的好处是，每一步都有明确目的。你不是为了“玩插件”而装插件，而是遇到一个具体问题，再加一个具体能力。

所以，完全没编程基础的人能不能上手 DSH？

我的答案是：可以试，但不要把它当成完全开箱即用的消费软件。它现在更像一个正在快速成长的 AI 工作台。用 KeySync 降低安装和远程门槛，用 Plugin Manager 降低插件选择门槛，再按 Codex、Claude Code、Files、Terminal 这些真实场景逐步加能力，会比直接照着命令大全折腾舒服很多。

相关链接：

- KeySync 下载：<https://sublang.ai/keysync/dl-dy>
- Relay DSH 插件目录：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md>
- DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
