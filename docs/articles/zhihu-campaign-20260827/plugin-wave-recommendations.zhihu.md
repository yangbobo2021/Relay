# DeepSeek Harness 一下子涌现出那么多插件，有没有大佬给一下推荐？

> 知乎问题：<https://www.zhihu.com/question/2072103596481683649>
>
> 发布口径：不是复用上一篇原文；先回应“插件突然变多，怎么选”的问题，再推荐自己开发、自己真实需要、自己日常使用的一套基础工作流插件。

我不敢自称大佬，但这段时间确实在高频折腾 DSH 插件。

如果你想要一个“大而全插件清单”，可以去看社区里那些合集回答。我这里推荐的是另一类：我自己开发、自己真实需要、自己也在用的一套工作流插件。

我筛插件时会先看一个标准：它是不是能改善每天都会遇到的基础体验。

很多插件很酷，但如果刚上手就一口气全装，很容易变成“看起来很多，真正用的时候还是乱”。所以我会先装基础设施类插件，再装垂直场景插件。

这套插件不是为了凑数量，而是解决我用 DeepSeek Harness 时最常遇到的几个问题：

- 插件太多，不知道该装哪个、怎么装；
- DSH 暂时不擅长的任务，需要切到 Codex / Claude 这些更成熟的开发助手；
- 开发助手一直在说项目文件，但用户看不到文件；
- 对话在一个地方，终端在另一个地方，来回切很烦；
- 长任务跑到一半，人离开办公室后还想继续接上。

所以如果你刚开始面对一堆 DSH 插件，我建议先别急着装很多。先把“插件管理、文件、终端、成熟开发助手接力、远程继续”这几个基础体验补上，再去试更垂直的插件。

## 1. 先装插件管理：Plugin Manager

第一个我会推荐插件管理插件。

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-manager>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-manager>

我开发它的原因很简单：每次给 DSH 装插件都要输入命令，时间久了很麻烦。

有些图形界面形式的插件管理也能用，但遇到安装失败、版本不合适、需要解释安装步骤的时候，还是不够灵活。DSH 本来就是对话环境，所以我更希望直接在对话里说：

- 帮我找一个文件浏览插件。
- 安装 Codex 插件。
- 列出当前已经安装的插件。

然后它给我搜索结果、安装计划、风险提示。涉及真实变更时，再让我确认。

插件生态变多以后，真正影响体验的不是“有没有插件”，而是“我怎么知道该装哪个，出了问题怎么处理”。所以我会把插件管理放在第一位。

## 2. 再接 Codex / Claude：DSH 暂时不擅长的任务交出去

第二类是 Codex 和 Claude Code 集成插件。

Codex 插件：

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-codex>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-codex>

Claude Code 插件：

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-claude>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-claude>

我做这两个插件，是因为 DSH 很有潜力，但老实说，有些任务它现在还不够顺手。

比如复杂代码修改、长时间读项目、跑测试、改错、继续上下文，这些事情 Codex 已经很成熟。再比如方案审查、文档分析、换一个角度检查边界，Claude Code 很适合。

所以我的用法不是“让 DSH 替代 Codex 和 Claude”，而是把 DSH 当成项目入口：

- 普通讨论：用 DSH；
- 复杂编码：切到 Codex；
- 方案审查：切到 Claude Code。

这样不用在几个工具之间来回找项目现场。DSH 负责组织会话，Codex 和 Claude 负责它们擅长的任务。

## 3. 终端集成：不用离开 DSH 看命令输出

第三个是终端插件。

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-terminal>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-terminal>

它通常搭配 Workbench 使用：

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-workbench>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-workbench>

我自己已经习惯用 Codex 开发，但开发时经常还是要看命令输出、确认当前目录、跑一下测试。

以前的问题是：对话在一个地方，终端在另一个地方。开发助手说“命令执行完了”，我还要切窗口去看。

终端插件解决的是这个小但高频的问题：在 DSH 当前项目里，底部直接有终端。它不是为了替代系统终端，而是为了减少来回切换。

## 4. 文件浏览：对话旁边就是项目文件

第四个是文件浏览插件。

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-files>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-files>

同样建议搭配 Workbench：

- GitHub：<https://github.com/yangbobo2021/relay-dsh-plugin-workbench>
- npm：<https://www.npmjs.com/package/relay-dsh-plugin-workbench>

这个插件解决的是另一个高频痛点：开发助手一直在说文件，但用户看不到文件。

有了 Files 之后，右侧可以直接浏览当前项目文件。Codex 改了什么、DSH 分析的是哪个文档、Claude 审查提到哪个文件，我都能顺手点开看。

它不是完整 IDE，也不是要替代编辑器。它更像是给 DSH 补一个“项目现场”。

## 5. KeySync：让长任务可以多设备接力

除了这些插件，我的 DSH 基本会搭配 KeySync 使用。

- KeySync 下载：<https://sublang.ai/keysync/dl-dy>

原因也很简单：我有很多任务不是坐在办公室等它跑完的。

用 KeySync 之后，我不用折腾公网服务器，也不用自己配穿透，而且目前完全免费。办公室电脑上跑着 DSH、Codex、Claude 会话，我在路上、家里、另一台电脑上，都可以直接回到原来的会话继续。

这个体验对长任务特别关键。不是重新开一个聊天窗口，而是继续办公室那台电脑上的原 DSH、原 Codex、原 Claude 对话。

## 总结

所以如果是“插件太多，先装哪些”的问题，我会推荐这套基础配置。它的重点不是炫功能，而是先把 DSH 的日常使用链路补完整：

- 插件安装管理：`relay-dsh-plugin-manager`
- Codex 集成：`relay-dsh-plugin-codex`
- Claude Code 集成：`relay-dsh-plugin-claude`
- 终端：`relay-dsh-plugin-terminal`
- 文件浏览：`relay-dsh-plugin-files`
- 面板宿主：`relay-dsh-plugin-workbench`

这不是最花哨的配置，但确实是我自己每天最舒服的配置。

DSH 负责项目入口；Codex 和 Claude 负责更复杂的开发和审查；Files 和 Terminal 把项目现场放回来；Plugin Manager 让插件安装不用每次查命令；KeySync 解决远程多设备接力。

后面我还会继续完善现有插件，也会继续开发新的 DSH 插件。感兴趣可以关注我的开源项目：

- Relay 项目和插件目录：<https://github.com/yangbobo2021/Relay>
