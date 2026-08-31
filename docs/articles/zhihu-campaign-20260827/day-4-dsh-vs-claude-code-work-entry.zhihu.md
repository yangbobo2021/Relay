# Day 4: 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？

> 知乎问题：<https://www.zhihu.com/question/2040450519303288568>
>
> 推荐首图：`docs/media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg`
>
> 发布建议：这篇是判断型回答，不要变成产品介绍。主线是“不是单次编码能力对标，而是工作入口对标”。

如果只把这件事理解成“DeepSeek 要做一个 Claude Code 平替”，我觉得会低估 Harness。

Claude Code 和 Codex 现在更像成熟的 Agent 执行后端：它们擅长读代码、改文件、跑命令、连续完成一个开发任务。

DeepSeek Harness 更像在争另一个位置：AI 工作的入口。

## 单次编码任务，成熟工具仍然更省心

如果今天只问一个很直接的问题：我要马上修一个 bug，应该用什么？

很多情况下，Codex、Claude Code 或 Cursor 仍然更省心。它们的产品体验、默认配置、错误处理、模型和工具链都更成熟。

所以我不建议普通用户把 DSH 当成“立刻替代一切”的工具。

但问题是，真实工作不只有一次编码任务。

你可能先用普通对话讨论需求，再用 Codex 改代码，再用 Claude Code 做审查，最后还要看文件、跑终端、隔天继续。这个时候，竞争点就从“谁这一次代码写得更好”，变成了“谁能承载整个工作现场”。

## DSH 有意思的地方：它可以把 Agent 当作可选工作模式

我用这组插件实测下来，最有意思的不是“DSH 替代了谁”，而是这个思路：

- Codex 仍然做 Codex 擅长的事；
- Claude Code 仍然做 Claude Code 擅长的事；
- DSH 负责项目入口、会话组织和旁边的文件、终端界面。

用户新建会话时，可以选择 DSH 原生模式、Codex 或 Claude Code。它们可以属于同一个项目工作区，但不会自动混成一段看不见的记忆。

![官方 DSH 中选择 Standard、Codex 或 Claude Code](../../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

这个模式和“平替”不太一样。

如果 DSH 只是想复制 Claude Code，那它要在每个细节上追成熟产品。但如果 DSH 是一个开放入口，它要解决的是：不同 Agent、文件、终端、权限、插件和会话能不能被组织到一起。

## 这对已经习惯 Codex 的用户有什么意义？

意义不是“离开 Codex”。

恰恰相反，是让原来习惯 Codex 的用户可以更低成本尝试 DSH。

你仍然把复杂编码任务交给 Codex，只是这段 Codex 会话出现在 DSH 的项目入口里。你可以旁边打开 Files 看项目文件，底部打开 Terminal 确认命令结果，之后再开一段 Claude Code 会话做审查。

![Codex 会话旁边显示当前项目的真实文件和终端](../../media/dsh-plugin-suite-live.png)

这就是我觉得 Harness 路线有价值的地方：它不一定要求用户立刻换掉熟悉工具，而是先把熟悉工具接到一个更开放的工作台里。

## KeySync 解决的是入口如何延续

如果 DSH 成为工作入口，另一个问题就会出现：这个入口能不能跨设备继续？

这就是 KeySync 的位置。

KeySync 不是 Agent 后端，也不是 DSH 插件。它负责在工作电脑上安装并运行官方 DSH，并提供远程入口。这样长任务跑着的时候，你可以从手机或另一台电脑回到原来的 DSH 会话。

这对“工作入口”很关键。因为 Agent 工作越来越像一个持续现场，而不是一次问答。人离开电脑后，如果只能重新开一个聊天窗口，很多上下文就断了。

## 我的判断

DeepSeek 做 Harness，短期看是在对标 Claude Code；长期看，更像是在争 Agent 运行时和工作入口。

这条路能不能走成，取决于三件事：

1. 原生 Agent 能不能越来越稳定；
2. 插件系统能不能承载真实生态，而不是只承载演示；
3. 普通用户能不能不理解复杂配置，也能一步步进入工作流。

Codex、Claude Code、Workbench、Files、Terminal 和 Plugin Manager 这组插件，验证的正是第三件事：不改 DSH 核心的情况下，能不能把成熟 Agent 和项目现场接进去。

所以我不会说 DSH 现在已经赢了 Claude Code。更准确的说法是：Claude Code 和 Codex 证明了 Agent 执行后端的价值，DSH 在尝试把这些能力组织成开放工作入口。这两件事并不冲突，甚至可以互相组合。

相关链接：

- Relay DSH 插件目录：<https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md>
- KeySync 下载：<https://sublang.ai/keysync/dl-dy>
- DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
