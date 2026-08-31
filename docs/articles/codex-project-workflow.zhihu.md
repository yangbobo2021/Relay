# 可以分享一下你用 Codex 重新组织的工作流吗？

> 知乎问题：<https://www.zhihu.com/question/2056332120906100745>
>
> 发布说明：从下方正文开始粘贴；图片使用文中标注的真实本地素材。

我最近最大的变化，不是给 Codex 写了更长的提示词，而是把工作的组织单位从“应用”改成了“项目”。

以前我会按工具找记录：需求讨论可能在 DeepSeek Harness，代码修改在 Codex，独立审查又在 Claude Code。几天后回头看，最费时间的往往不是继续写代码，而是先想起某个结论到底留在哪个窗口里。

现在我的做法是：项目留在同一个 Workspace，工具按任务选择，每个 Agent 保留自己的会话。

## 先按项目收拢，而不是让几个 Agent 混用一段上下文

我使用官方 DeepSeek Harness（DSH）管理 Workspace 和 Session，再通过独立插件加入 Codex 和 Claude Code 会话后端。

新建会话时可以选择 DSH 原生模式、Codex 或 Claude Code。它们可以位于同一个项目下面，但不会共享一段看不见的“万能记忆”：

- DSH 原生会话仍由 DSH 负责；
- Codex 会话绑定一个真实 Codex App Server Thread；
- Claude Code 会话延续自己的 Claude Session。

![官方 DSH 中的 Standard、Codex 和 Claude Code 模式](../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

这个边界对我很重要。统一的是项目入口、会话列表和工作目录，不是把几个 Agent 的上下文搅在一起。出了问题时，我仍然知道是哪一个执行后端做了什么。

## 已经做过的 Codex 工作不用从头讲

接入新工作流时，我已经在 Codex 里积累了不少 Thread。如果为了换一个管理界面就重新描述需求、测试和实现思路，这个工作流没有意义。

Codex 插件现在可以按 Workspace 扫描已有 Thread，把它们导入为普通 DSH Session。标题和最近活动顺序会保留，重复导入不会再创建一份。打开导入的 Session 后，DSH 显示已有对话，后续消息仍然继续原来的 Codex Thread。

![导入后的 Codex Session 保留标题和活动顺序](../media/codex-import-list.png)

这里没有把 Codex 的模型上下文复制成另一套数据库。Codex App Server 仍然拥有 Thread、工具状态和上下文压缩；DSH 保存用于展示的会话历史和一对一绑定。

## 我现在怎样分配任务

我的分法并不是固定规则，大致是：

- 需求还不清楚、只是讨论方案时，先用 DSH 原生会话；
- 需要连续读代码、改文件、运行命令和修测试时，新建或继续 Codex 会话；
- 实现完成后，需要另一种视角检查边界和遗漏时，单独开 Claude Code 会话。

例如做一个插件功能，我会先把功能边界和验收场景写进仓库 SPEC，再让 Codex 实现。完成后，不直接以“测试通过”作为结束，而是在全新目录安装正式包，用官方 DSH 走一次真实用户路径。Claude Code 可以用于独立检查代码和测试是否真的覆盖了 SPEC。

当前还不是自动多 Agent 编排。DSH 不会自动把第一段需求对话总结给 Codex，也不会在 Codex 完成后自动通知 Claude 审查。交接仍然由我决定，重要要求仍然要写进项目文件，而不是只依赖聊天历史。

## 对话旁边保留最小的项目现场

我还安装了可选的 Workbench、Files 和 Terminal 插件。Codex 提到一个文件时，可以在右侧直接查看；需要核对命令时，可以打开底部真实终端。

![Codex 对话旁边显示当前 Workspace 的真实文件](../media/dsh-plugin-suite-live.png)

Files 目前主要用于查看，不是完整编辑器。Terminal 也不是浏览器里模拟的输出，它需要后端提供真实 Shell。这些边界会让它比 IDE 简单，但足够减少“Agent 说改了文件，我又去另一个窗口找”的切换。

## 这个工作流实际解决了什么

它没有让 Codex 本身变得更聪明，也没有自动完成多 Agent 协作。它解决的是三个更朴素的问题：

1. 同一个项目的对话不再按应用散落；
2. 已有 Codex Thread 可以继续，不必从头交代；
3. 普通讨论、代码实现和独立审查可以按任务选择成本和能力。

Codex 插件可以单独安装，不依赖 Relay 事件系统，也不要求维护一份修改过的 DSH Fork。现在 npm 稳定版是 `relay-dsh-plugin-codex@0.1.2`。源码、安装方法和已验证的 DSH 版本都放在这里：

<https://github.com/yangbobo2021/relay-dsh-plugin-codex>

完整的 DSH 插件组合和后续事件协作研究在 Relay：

<https://github.com/yangbobo2021/Relay>
