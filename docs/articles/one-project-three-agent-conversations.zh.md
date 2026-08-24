# 一个项目，三种 AI 对话：我为什么把 DSH、Codex 和 Claude 放在一起

[English](one-project-three-agent-conversations.md) | 中文 | [系列目录](dsh-agent-workbench-series.zh.md)

我并不是因为 Codex 或 Claude Code 不好用，才把它们接进 DeepSeek Harness。恰恰
相反，是因为它们各有所长，我不想每天围着工具安排工作。

一个普通开发任务很容易变成这样：先在 DSH 里讨论需求，发现需要大范围修改后切到
Codex；实现完成，再打开 Claude Code 做一次独立审查；中间还要在编辑器和终端里
确认文件。几小时后，真正难找的往往不是代码，而是“刚才那段结论在哪个窗口里”。

我想换一种组织方式：项目留在原地，工具按任务选择。

![DSH 中的 Codex、Claude Code、Files 和 Terminal 实机演示](../media/dsh-plugin-suite-demo.gif)

## DSH 是入口，不是唯一答案

DSH 原生对话仍然有价值。普通问题、短任务和已经适配好的工作，没有必要每次都换到
另一个 Agent。可一旦任务超出当前能力范围，用户也不应该被迫离开项目工作区，重新
到另一个应用里建立上下文。

安装插件后，新建 DSH 会话时可以选择原生模式、Codex 或 Claude Code。DSH 继续
负责会话、工作区和界面；Codex 会话由 Codex App Server Thread 驱动，Claude
会话由 Claude Agent SDK 驱动。它们不是把另一个模型伪装成普通 API 回复，而是
保留各自的执行后端和会话连续性。

这里最重要的变化不是“一个页面里多了两个菜单项”，而是会话仍然归属于项目。
同一个仓库里的需求讨论、实现、审查和验证，可以放在同一个 Workspace 分组下，
不用按应用回忆历史。

## 成本和质量不是二选一

“哪个 Agent 最强”不是我每天真正面对的问题。更常见的问题是：这个任务值得使用
哪个后端？

- 一个十分钟能说清楚的普通问题，可以先用 DSH 原生对话。
- 需要连续修改文件、运行命令和修复测试时，可以新建 Codex 会话。
- 需要从另一种思路审查实现、比较方案或处理复杂分析时，可以新建 Claude Code 会话。

这不是固定分工，也不是一份模型排行榜。订阅方式、模型版本、任务类型和团队习惯都会
改变成本与质量。统一入口的意义，是保留选择权：简单任务不必使用最昂贵的路径，关键
任务也不必为了省一点调用成本接受较差结果。

## 现在已经能做什么

当前发布的插件已经完成这些事情：

- 在 DSH 新建会话菜单中加入 Codex 和 Claude Code；
- 让 Codex Thread 与 Claude Session 在各自的 DSH 多轮会话中继续；
- 保留 DSH 的输入、历史、审批和工具展示；
- 用 Workbench 承载右侧 Files 和底部 Terminal；
- 让会话使用自己的项目工作目录。

Codex、Claude 两个插件可以独立安装，不依赖 Relay Events。完整插件和 npm 入口：

- [relay-dsh-plugin-codex](https://github.com/yangbobo2021/relay-dsh-plugin-codex)
- [relay-dsh-plugin-claude](https://github.com/yangbobo2021/relay-dsh-plugin-claude)
- [全部 Relay DSH 插件](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md)

## 还没有发生的事

现在仍然是用户决定由哪个 Agent 接手，并分别创建会话。系统不会自动把 DSH 对话
压缩后交给 Codex，也不会在 Codex 完成实现后自动叫 Claude 审查。统一界面不等于
多 Agent 编排已经完成。

但项目、会话和执行后端已经不再绑死在一起。这是下一步协调的前提：任务可以属于
项目，Agent 可以被选择，未来的 Relay 事件和交接机制才有清楚的落点。

我更愿意把当前版本看成一个可用的项目工作台，而不是一张宏大的多 Agent 蓝图。
今天它先解决切换工具、整理会话和按任务选择成本/质量的问题；自动协作，等有真实
闭环后再谈。

下一篇会具体拆开 Codex 插件：谁启动 App Server、一次 DSH 会话如何绑定 Thread，
以及它为什么不是简单执行一个 `codex` 命令。

