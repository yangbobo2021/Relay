# 不改 DSH 核心：用插件加入 Codex、Claude Code、文件浏览和终端

[English](no-fork-dsh-plugins.md) | 中文

这是插件安装与技术参考。按使用场景阅读，请从
[《把 DSH 变成多 Agent 项目工作台》系列](dsh-agent-workbench-series.zh.md)开始。

DeepSeek Harness 很适合作为统一的对话界面，但扩展它时很容易陷入一个昂贵的
选择：修改 DSH 核心，然后不断解决上游合并冲突；或者保留官方 DSH，却在多个
Agent 和开发工具之间来回切换。

现在有了第三条路。五个可独立安装的插件，可以在官方 DSH 中加入 Codex、
Claude Code、工作区文件浏览和终端。它们使用 DSH 插件机制，所以更新官方版本
时不需要维护 Fork。

![通过插件运行在 DSH 中的 Codex、Claude Code、Files 和 Terminal](../media/dsh-plugin-suite-demo.gif)

演示来自官方 DSH 上的真实 npm 安装与实际操作，不是界面模型或静态拼接：
[打开 H.264 MP4](../media/dsh-plugin-suite-demo.mp4?raw=1)，或查看
[验收证据](../acceptance/dsh-plugin-demo-qa.md)。

这篇文章适合想增加对话后端，或希望 DSH 更接近完整编码工作台的用户。它不是
Relay Events 教程：这里的五个插件不依赖 Relay 事件运行时。

## 安装后到底改变了什么？

安装 Codex 插件后，DSH 的新建会话模式菜单中会出现 **Codex**。每个会话由
Codex App Server Thread 驱动，同时继续使用 DSH 原生的对话历史、输入框、审批、
提问和工具展示。

安装 Claude 插件后，菜单中会出现 **Claude Code**。它通过 Claude Agent SDK
运行，并在 DSH 多轮对话中延续同一个 Claude Session。

安装 Workbench 和 Files 后，DSH 会出现右侧工作区文件树和文本预览。安装
Workbench 和 Terminal 后，则会出现底部 xterm 终端。Terminal 的界面与执行
后端分离；在当前已发布的这组插件中，Codex 可以提供真实终端 provider。

这些能力彼此独立。只想使用 Codex 的用户，不需要安装 Claude、Workbench、
Files、Terminal 或 Relay Events。

## 为什么插件边界很重要？

Codex 和 Claude 是两个独立对话后端。Workbench 只拥有右侧、底部视图的公开
契约。Files 和 Terminal 通过这些契约注册界面，不导入彼此的实现。Terminal
通过公开 provider 注册表接入执行后端，也不会直接调用 Codex 内部代码。

这种边界带来两个直接结果：

1. 官方 DSH 是不可修改的依赖，不再是一套需要长期合并的定制代码。
2. 每个插件都能独立版本化、测试和安装，未来迁移到其他仓库时，也不用拖着
   整个 Relay 一起搬迁。

Relay 是这组插件的维护和兼容性验证工作区。Relay Events 仍然是独立可选能力，
负责持久 Wait、Monitor、外部 Event、路由，以及把事件投递回正确的 DSH Session。

## 从 npm 安装

下面的命令已经针对官方 DeepSeek Harness `0.1.1-rc.2`、Commit
[`b150a551`](https://github.com/deepseek-ai/deepseek-harness/commit/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e)
完成验证。环境需要 Node.js 22.13 或更高版本，并确保 `pnpm` 位于 `PATH`。

先停止正在运行的 DSH Web，再安装自己需要的组合。

只安装 Codex：

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@next
```

只安装 Claude Code：

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-claude@next
```

安装 Files、Terminal，并由 Codex 提供真实终端：

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest \
  relay-dsh-plugin-codex@next
```

在当前 DSH 预览阶段，两个后端推荐使用候选版本：Codex `next` 已内置跨平台
App Server 运行时，Claude `next` 包含当前的模型选择同步修复。正式固定版本前，
请在对应 npm 页面再次确认 dist-tag。

重新启动 DSH Web：

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 web
```

Codex 和 Claude 仍然需要各自正常的本地认证，插件不会收集凭据。Workbench
本身也不会凭空增加一个空面板，只有视图插件注册后才会显示界面。

## 从 GitHub 安装开发版本

如需测试尚未发布的 Commit，可以直接从 GitHub 安装：

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-codex#main \
  github:yangbobo2021/relay-dsh-plugin-claude#main \
  github:yangbobo2021/relay-dsh-plugin-workbench#main \
  github:yangbobo2021/relay-dsh-plugin-files#main \
  github:yangbobo2021/relay-dsh-plugin-terminal#main
```

需要可复现安装时，请把 `#main` 替换为 Tag 或完整 Commit SHA。GitHub 包要
明确列出，因为 DSH 的 pnpm Profile 不接受隐藏在传递依赖中的 GitHub 包。

## 开始工作前如何验收？

新建一个会话，检查以下可见结果：

- 模式菜单只出现自己安装的对话后端；
- 选择工作区后，Files 可以打开并预览文本文件；
- Terminal 出现在底部 Workbench 面板；
- 真实终端会明确显示 provider 状态，不会悄悄退回到其他执行方式。

也可以从命令行检查插件组成：

```bash
dsh plugin --profile web why relay-dsh-plugin-codex
dsh plugin --profile web why relay-dsh-plugin-files
dsh plugin --profile web why relay-dsh-plugin-terminal
```

每个仓库都会在 CI 中检出固定的官方 DSH 版本进行验证。Tag 发布通过各仓库的
npm Release Workflow 完成；Codex 和 Claude 当前候选包已有 SLSA provenance，
Workbench 系列仓库也已经配置为从下一个 Tag 开始生成来源证明。

## 哪些人暂时不需要安装？

如果 DSH 标准 Agent 和现有对话界面已经满足需求，什么都不用安装。如果只是
想在对话之外打开命令行，普通终端反而更简单。如果真正的问题是收到邮件、Webhook
或监控条件变化后唤醒长期任务，那属于 Relay Events，而不是一次安装全部 UI 插件
的理由。

建议从一个明确能力开始。打开
[Relay DSH 插件目录](../dsh-plugins.zh.md)，可以找到全部仓库、npm 包、依赖规则和
故障排查入口。遇到兼容性问题时，也可以直接在对应插件仓库提交 Issue。
