# 把 DSH 变成多 Agent 项目工作台

[English](dsh-agent-workbench-series.md) | 中文

这个系列记录一个很具体的选择：把 DeepSeek Harness 当作日常项目入口，同时保留
DSH 原生对话、Codex 和 Claude Code 各自的长处。目标不是再造三个 Agent，而是让
用户按项目管理对话，按任务选择后端，并为以后真正的 Agent 协作留出边界。

1. [一个项目，三种 AI 对话](one-project-three-agent-conversations.zh.md)：为什么统一入口、项目管理和成本/质量选择比“只用一个最强模型”更实用。
2. [复杂编码任务交给 Codex](codex-app-server-in-dsh.zh.md)：Codex App Server 如何成为 DSH 中的真实对话后端。
3. [分析和审查交给 Claude Code](claude-code-in-dsh.zh.md)：如何在 DSH 中保留 Claude Session 的多轮连续性。
4. [不只是聊天](dsh-project-workbench.zh.md)：Files、Terminal 和 Workbench 如何把会话放回真实项目环境。
5. [从选择 Agent 到协调 Agent](from-agent-choice-to-coordination.zh.md)：哪些能力已经存在，自动交接和事件驱动协调还缺什么。

安装命令、版本基线和完整插件列表见
[插件安装与技术指南](no-fork-dsh-plugins.zh.md)。系列中的演示来自官方
`@deepseek-ai/dsh@0.1.1-rc.2`、实际 npm 包和真实模型请求，不是界面稿。

