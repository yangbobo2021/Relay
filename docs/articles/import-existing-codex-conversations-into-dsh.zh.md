# 不用从头开始：把已有 Codex 对话导入 DeepSeek Harness

[English](import-existing-codex-conversations-into-dsh.md) | 中文 | [系列目录](dsh-agent-workbench-series.zh.md)

我想把 DSH 当作项目入口，但不想为了换一个界面，把已经在 Codex 里讨论过的需求、
测试和实现思路重新说一遍。

`relay-dsh-plugin-codex@0.1.1-rc.4` 增加了 Workspace 级导入：找到这个项目已有的
Codex Thread，把它们变成普通的 DSH Session。打开后能看到原来的历史，也能继续
同一个 Thread。

![导入 Codex 历史后，在 DSH 中继续同一个 Thread](../media/codex-import-continue.png)

这不是一张界面稿。图中使用的是官方 DSH `0.1.1-rc.2`、npm 发布的 Codex 插件和
真实 Codex App Server 对话。

## 先安装插件

先停止正在运行的 DSH Web，再安装 npm 的候选版本：

```bash
dsh plugin --profile web add relay-dsh-plugin-codex@next
dsh web
```

`next` 当前指向 `0.1.1-rc.4`。如果你希望以后重装时仍得到本文实测的版本，可以把
第一条命令里的 `@next` 换成 `@0.1.1-rc.4`。

还没发布的开发版本也可以直接从 GitHub 安装：

```bash
dsh plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-codex#main
```

插件自带固定版本的官方 Codex App Server 运行时，支持 macOS、Windows 和 Linux，
默认不依赖全局 `codex` 命令。不过 Codex 认证仍然需要先完成，并且 DSH 要由同一个
系统用户启动，才能看到这个用户的 Codex 会话。

## 一次导入整个 Workspace

在 DSH 中添加或打开项目 Workspace，然后点击左下方的 **Import Codex Sessions**。
插件会按项目路径扫描 Codex 会话，并先显示汇总数字。

![为 Release Notes CLI Workspace 找到三条 Codex 会话](../media/codex-import-scan.png)

当前版本是整批导入，不提供逐条勾选。确认后点击 **Import all**。这次实测找到 3
条、成功导入 3 条、失败 0 条。

![三条 Codex 会话全部导入成功](../media/codex-import-complete.png)

## 标题和顺序不会被抹掉

导入完成后，Session 会直接显示 Codex 原来的标题，并按 Codex 的最近活动时间排列。
不需要先逐个打开，才能知道哪条会话是什么。

![导入后的三条 Codex 会话保留标题和活动顺序](../media/codex-import-list.png)

重复执行导入也不会产生副本。本次复测显示 `Found 3`、`Existing 3`、`Ready 0`。

## 打开历史，接着聊

打开导入的 Session 时，插件通过一次 `thread/read` 把缺少的终态用户消息和助手消息
补进 DSH 的展示历史。原来的工具步骤、答案、模型和推理强度都能在同一个页面看到。

![DSH 中恢复的真实 Codex 历史和工具步骤](../media/codex-import-history.png)

随后发送“第一步应该先实现什么”，Codex 根据上一轮四步方案继续回答，而不是从一段
空白上下文重新开始。切换到另一条 Session 再返回后，两轮历史仍然完整。

## 它复制了什么，没复制什么

DSH 保存正常的聊天展示历史，以及 DSH Session 与 Codex Thread 的一对一绑定。
Codex App Server 仍然负责模型上下文、工具状态和上下文压缩。插件不会把 Codex 的
私有运行记录复制成另一套数据库。

有三条边界需要提前知道：

- 当前按整个 Workspace 导入，不能只选其中一条 Thread。
- Session 每次打开时同步一次；不会后台轮询，也没有手动刷新按钮。
- 同一个 Codex Thread 不能同时有两个 App Server 写入者。要在 DSH 中继续它，先完整退出占用该 Thread 的 Codex 客户端或进程。

这个功能解决的是一个很朴素的问题：换到 DSH 管理项目对话时，不必放弃已经做过的
Codex 工作。DSH 原生会话、Codex 和 Claude 可以集中在一个项目下面，再按任务的
质量、成本和工具能力选择后端。

- [Codex 插件 GitHub 仓库](https://github.com/yangbobo2021/relay-dsh-plugin-codex)
- [npm 包：relay-dsh-plugin-codex](https://www.npmjs.com/package/relay-dsh-plugin-codex)
- [Relay：多后端对话与事件驱动 Agent 工作流](https://github.com/yangbobo2021/Relay)
- [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)
