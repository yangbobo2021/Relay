# 不只是聊天：用 Files 和 Terminal 把 DSH 变成项目工作台

[English](dsh-project-workbench.md) | 中文 | [系列目录](dsh-agent-workbench-series.zh.md)

把 Codex 和 Claude Code 接进 DSH，只解决了对话入口的问题。真正开始改项目时，我
仍然会问两个很朴素的问题：Agent 正在看哪个目录？它说修改了文件，我能不能马上打开
确认？

如果答案仍然是“去编辑器和另一个终端里找”，统一对话只完成了一半。

DSH 已经有 Workspace 和按项目分组的 Session。Workbench、Files、Terminal 三个
插件利用这条现有边界，把当前 Session 的项目环境带到会话旁边。

![右侧 Files 显示真实 Relay 工作区文件](../media/dsh-plugin-suite-live.png)

## Workbench 只负责留出位置

Workbench 是公共壳层，不读取文件，也不启动 Shell。它提供右侧视图和底部视图的
注册契约，并负责这些区域的布局、显示和关闭。

这个划分看起来多了一个包，实际避免了更麻烦的结果：如果 Files 自己修改 DSH 布局，
Terminal 再修改一次，以后每增加一个右侧视图都要互相了解实现。现在功能插件只声明
“我要注册到 side”或“我要注册到 bottom”，不直接导入彼此代码。

单独安装 Workbench 不会出现一个没有内容的空面板。只有 Files 或 Terminal 注册
视图后，对应界面才会出现。

## Files 跟着当前 Session 的工作目录

Files 在右侧显示当前 Session Workspace 的目录树，可以展开目录、过滤文件并预览
文本。路径通过 Session 传给 Host 端文件能力，不由浏览器随意读取本机文件系统。

它目前是一个面向查看的文件浏览器，不是完整编辑器。二进制文件、超出预览范围的内容
和编辑保存仍然应该交给合适工具。这个限制反而让它的用途很清楚：Agent 提到一个文件
时，用户不离开对话就能核对当前内容。

## Terminal 需要一个真实 provider

Terminal 插件提供底部 xterm 界面、输入输出、尺寸变化和 Session 关联，但它不在
内部硬编码某个 Shell 后端。真实进程由实现公开终端能力的 provider 提供。

当前已发布组合中，Codex 插件可以提供这个 provider。因此安装 Workbench、Terminal
和 Codex 后，终端会在当前项目目录启动真实 Shell，输入、输出和窗口 resize 都通过
后端传输，而不是在页面里模拟命令结果。

![底部 Terminal 在 Relay 工作区执行真实命令](../media/dsh-terminal-command-live.png)

如果只安装 Terminal 而没有 provider，界面会明确提示缺少交互终端能力，不会悄悄
回退到一个假的终端。

## 项目管理为什么比聊天列表重要

一个项目里可以同时存在几种 Session：

- DSH 原生会话记录需求、短任务和日常讨论；
- Codex 会话记录实现过程；
- Claude Code 会话记录审查和第二意见。

它们共享的是项目归属，不是模型上下文。Files 和 Terminal 读取当前 Session 的
Workspace，因此用户切换会话时，看到的项目环境也跟着切换。这个模型比“所有 Agent
共享一段不可见记忆”更容易理解，也更容易审计。

## 安装项目工作台

下面的三个 UI 插件当前都是 `0.1.0` 稳定版。如果希望终端由 Codex 提供真实 Shell，
再加入 Codex 候选版本：

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest \
  relay-dsh-plugin-codex@next

npx @deepseek-ai/dsh@0.1.1-rc.2 web
```

- [Workbench 仓库](https://github.com/yangbobo2021/relay-dsh-plugin-workbench)
- [Files 仓库](https://github.com/yangbobo2021/relay-dsh-plugin-files)
- [Terminal 仓库](https://github.com/yangbobo2021/relay-dsh-plugin-terminal)

我的目标不是把 DSH 做成另一个重量级 IDE。对 Agent 工作来说，先把项目、对话、文件
证据和执行现场放在同一个可追踪空间里，已经能减少很多无意义的窗口切换。

