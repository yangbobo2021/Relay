# Day 2: 普通人用 DeepSeek Harness 都能干些什么？

> 知乎问题：<https://www.zhihu.com/question/2071616098441455091>
>
> 推荐首图：`docs/media/keysync-dsh-agent-workbench/01-three-device-handoff.png`
>
> 发布建议：这篇主角是 KeySync + 原会话继续，不要写成插件安装教程。技术名词只保留 DSH、Codex、Claude Code、KeySync 四个。

普通人用 DeepSeek Harness，最不应该从“开发插件”开始。

更实际的入口是：把正在做的 AI 工作，放进一个可以持续回来的项目现场。

很多人第一次看 DSH，会被插件、配置、命令行这些东西劝退。但如果换一个角度，它对普通用户有一个很朴素的价值：你可以把同一个项目里的不同 AI 对话收拢起来，不用每次换工具都换一个工作现场。

## 一个普通用户真正会遇到的问题

比如你已经习惯用 Codex 写代码，也偶尔用 Claude Code 做方案审查。平时看起来没问题，但过几天回头找记录，很容易变成这样：

- 需求讨论在一个窗口；
- Codex 改代码在另一个窗口；
- Claude 审查意见在第三个窗口；
- 文件和终端又在别的地方。

DSH 的价值不是让你立刻放弃 Codex 或 Claude Code，而是把这些会话放回同一个项目入口。

![Mac、Windows 和手机上的同一 DSH 任务实录合成](../../media/keysync-dsh-agent-workbench/01-three-device-handoff.png)

## KeySync 解决的是另一件事：人离开电脑以后怎么办

很多 AI 任务不是 30 秒结束的。尤其是代码检查、批量整理文档、跑测试、长时间分析，常常是人已经准备离开，任务还在继续。

这时重新在手机上开一个聊天工具，其实帮助不大。你真正需要的是回到原来的项目、原来的会话。

KeySync 做的就是这件事：

- 在你的工作电脑上安装并运行官方 DSH；
- 提供一个远程入口，让你从手机、平板或另一台电脑打开这台机器上的 DSH；
- 保持原来的项目、会话、文件和终端现场。

它不是把任务搬到云端，也不是远程控制整台电脑。更像是给你正在运行的 DSH 开了一个安全入口，让你在合适的设备上继续看和继续操作。

## 这和插件有什么关系？

普通用户不用先理解插件系统，只要理解四个角色：

1. DSH：项目和会话入口。
2. Codex 插件：让你在 DSH 里继续用 Codex 做代码任务。
3. Claude Code 插件：让你在 DSH 里用 Claude Code 做分析和审查。
4. KeySync：让你离开工作电脑后还能回到原来的 DSH 会话。

KeySync 一键安装 DSH 时，会内置 Plugin Manager。它的作用是让你后续通过对话找插件、看安装计划、确认安装，而不是到处复制命令。

也就是说，KeySync 降低的是“怎么进入 DSH、怎么远程回来”的门槛；Plugin Manager 降低的是“怎么找到和安装插件”的门槛；Codex 和 Claude 插件解决的是“我原来习惯的 Agent 怎么接进来”。

![KeySync 中的 DeepSeek Harness 一键安装入口](../../media/keysync-dsh-agent-workbench/02-keysync-install-dsh.jpg)

## 普通人可以怎么用

我觉得比较合理的路径是：

第一步，只把 DSH 当作项目入口。新建一个项目工作区，先用普通对话整理需求、记录决策。

第二步，如果你原来习惯 Codex，就把 Codex 接进 DSH。代码任务仍然交给 Codex，只是会话入口换到 DSH 里。

第三步，如果你需要另一个视角审查方案或文档，再接 Claude Code。它不需要和 Codex 混成一段上下文，单独开一段审查会话反而更清楚。

第四步，如果你经常离开工位，就用 KeySync 从手机或另一台电脑回到原会话。不要新建会话，继续原来的那一段。

## 哪些人暂时不适合

如果你只是偶尔问几个问题，直接用熟悉的聊天工具就够了。

如果你完全不做长任务、不需要项目现场、不需要跨设备继续，也没必要为了新鲜感折腾 DSH。

但如果你已经开始把 AI 当作日常工作的一部分，尤其是代码、文档、审查、测试这些会跨好几天的任务，DSH + KeySync 的意义就出来了：不是让 AI 突然变聪明，而是让工作不要散。

相关链接：

- KeySync 下载：<https://sublang.ai/keysync/dl-dy>
- DSH 多设备实战说明：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/articles/keysync-dsh-multi-device-agent-workbench.zh.md>
- Relay DSH 插件目录：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md>
