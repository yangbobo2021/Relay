# 复杂编码任务交给 Codex：把 Codex App Server 接入 DSH

[English](codex-app-server-in-dsh.md) | 中文 | [系列目录](dsh-agent-workbench-series.zh.md)

DSH 原生对话可以处理很多日常工作，但遇到需要连续改文件、跑测试、根据失败结果再修
一轮的任务时，我会希望直接使用 Codex。问题是，我不想因此离开 DSH，也不想让同一
项目的实现记录散落到另一个应用里。

所以 Codex 插件做的不是“从 DSH 调一下 OpenAI API”，而是把 Codex App Server
作为一种完整的会话后端接进来。

![Codex App Server 在 DSH 中返回真实回复](../media/dsh-codex-conversation-live.png)

## 谁启动 App Server

早期实现依赖系统里的 `codex` 命令。它在开发机上能工作，换到一台没有全局 CLI 的
机器，就会得到很直接的错误：`spawn codex ENOENT`。这不是认证失败，而是 DSH
进程根本找不到要启动的程序。

现在的 npm 候选版本把官方 `@openai/codex` 运行时作为固定依赖安装。插件激活时，
由 DSH Host 启动 `codex app-server` 子进程，通过 JSON-RPC 与它通信。运行时包含
macOS、Windows、Linux 的 x64/arm64 原生包，因此默认不依赖用户的 `PATH`。

认证仍然使用 Codex 正常的本地认证机制。插件不会读取或保存账号密码，也不会替用户
登录。它解决的是“由谁提供并启动 App Server”，不是绕过 Codex 身份验证。

## 一个 DSH Session 对应一个 Thread

用户在新会话中选择 Codex 并发送第一条消息时，插件会为该 DSH Session 创建一个
Codex Thread。后续消息继续发到同一个 Thread，而不是每一轮都执行一次无状态命令。

这条绑定很重要。模型、推理强度、工作目录、审批策略、正在进行的 Turn，以及 Codex
产生的工具活动，都有持续的归属。DSH 负责把这些内容呈现在原来的聊天界面中；Codex
仍然负责自己的模型上下文和执行行为。

实际可见的结果包括：

- 模型与推理强度选择会跟随 Codex 会话；
- 流式回答和推理显示在 DSH 对话中；
- 执行命令、修改文件和用户提问会进入 DSH 的工具/审批界面；
- 可以中断当前 Turn，之后继续同一个 Thread；
- 单独安装 Terminal 插件后，Codex 可以提供真实交互终端 transport。

## 我会在什么时候切到 Codex

我不会为了证明插件存在，把所有问题都交给 Codex。比较自然的切换点是：任务已经从
“讨论应该怎么做”进入“需要在仓库里完成它”。例如：

1. 先在 DSH 原生对话里澄清需求和范围；
2. 在同一 Workspace 下新建 Codex 会话；
3. 让 Codex 阅读代码、实施修改并运行测试；
4. 保留原生会话作为需求记录，Codex 会话作为实现记录。

当前版本不会自动把第一段对话总结后交给 Codex。需要交接的信息仍由用户提供。这条
限制应该说清楚，但它并不妨碍项目中的会话先集中到一个地方。

## 安装一个能实际运行的版本

下面的命令针对官方 DSH `0.1.1-rc.2` 验证过。`next` 当前指向带内置跨平台
App Server 运行时的 `0.1.1-rc.3`：

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@next

npx @deepseek-ai/dsh@0.1.1-rc.2 web
```

然后添加项目 Workspace，新建 Session，在模式菜单中选择 **Codex**。如果只安装
这个插件，DSH 只增加 Codex，不会顺带安装 Claude、Files、Terminal 或 Relay
Events。

- [GitHub 仓库](https://github.com/yangbobo2021/relay-dsh-plugin-codex)
- [npm 包](https://www.npmjs.com/package/relay-dsh-plugin-codex)
- [实机验收记录](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/acceptance/dsh-plugin-demo-qa.md)

我希望这个插件最终给人的感觉不是“DSH 调用了 Codex”，而是“这个项目里有一段由
Codex 完成的会话”。前者是接口拼接，后者才是项目工作流。

