# 不是做个能跑的 Demo：我们为两个 DSH 插件做了 162 项迁移测试

我们一直在用 Codex 和 Claude Code 开发 Relay，也用它们处理插件仓库里的实现、
测试、审查和问题排查。把 DeepSeek Harness（DSH）作为项目入口以后，我们希望
继续这些工作，而不是换一个界面，就放弃原来已经能用的能力和会话。

因此我们维护了两个可以独立安装到官方 DSH 的插件：

- **`relay-dsh-plugin-codex`**（[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-codex) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-codex)）把 Codex App Server
  接成 DSH 的对话后端；
- **`relay-dsh-plugin-claude`**（[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-claude) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-claude)）把 Claude Code Agent
  SDK 接成 DSH 的对话后端。

两个插件都不需要修改 DSH 核心，也不要求用户下载整个 Relay 仓库。安装后可以在
DSH 中直接创建 Codex 或 Claude Code 会话，并继续使用 DSH 的项目、历史、输入框
和工具界面。

如果目标只是做出一个 Demo，到这里就够了：选中一个后端，发出问题，收到回答。
但我们自己要长期使用，判断标准不能停在“能回复”。

## 我们不想把问题留给用户发现

一次成功对话说明不了多少问题。

模型是否真的收到了图片？运行十分钟的命令时能否看到进度？点击中断后，后台进程
是否停止？重启服务还能不能回到原会话？项目里的 Skills、MCP 和配置是否仍然
生效？工具使用过的敏感值会不会留在磁盘上？

这些都不是演示时最容易看到的部分，却会决定插件能不能进入日常工作。既然我们
自己也在使用，就不能先写一句“已经支持 Codex 和 Claude”，再等用户替我们找出
其中的限制。

我们选择先把边界查清楚。能完成的记录为支持，只完成一部分的单独标记，不能完成
的保留为失败。测试的目的不是得到一个好看的数字，而是知道下一步该改什么，也让
用户知道哪些工作现在可以交给插件。

## 162 项测试从哪里来

我们把真实开发工作拆成了 162 项原子要求：Codex 76 项，Claude 86 项。每一项都
对应独立用例、运行记录和结果。

范围包括对话和多轮上下文、图片与文件、代码和 Shell 工具、测试与 Git、Skills、
MCP、项目配置、权限、环境变量、会话导入、服务重启和长上下文延续。它们不是为了
覆盖名词，而是来自我们实际使用 Codex 和 Claude Code 时会走到的路径。

截至 2026 年 8 月 29 日，162 个用例全部得到结果，共保留 167 次验证运行。五次
额外运行来自 Codex 的复测，不会重复计数。

| 插件 | 原子能力 | 支持 | 部分支持 | 不支持 |
| --- | ---: | ---: | ---: | ---: |
| `relay-dsh-plugin-codex` | 76 | 59 | 6 | 11 |
| `relay-dsh-plugin-claude` | 86 | 78 | 3 | 5 |

验证用例、运行记录和支持矩阵都保存在插件仓库中：
[Codex 验证材料](https://github.com/yangbobo2021/relay-dsh-plugin-codex/tree/main/validation/migration-compatibility)；
[Claude 验证材料](https://github.com/yangbobo2021/relay-dsh-plugin-claude/tree/main/validation/migration-compatibility)。

这张表是 **8 月 29 日发现问题时的快照**。它不是当前版本的通过率。8 月 30 日
发布的 Codex `0.1.3` 和 Claude `0.1.4` 已经修复其中多项失败，新的完整数字要等
162 项回归再次完成后再更新。

## 失败让我们重新检查了几件事

### 迁移不是把界面接起来

测试中出现过一种很容易误判的情况：DSH 正常显示了用户上传的图片，但 Codex 的
实际运行记录里没有图片输入。界面看起来没有问题，模型收到的内容却不完整。

Claude 也有类似的连续性问题。插件可以创建新会话，但当时没有可靠的原生会话导入
路径。用户进入 DSH 后仍要从头开始，这不符合我们把 DSH 作为项目入口的初衷。

这些失败促使我们补上 Codex 的图片传输，并为两个插件完善已有会话的选择和导入。
我们关心的不是菜单里多出两个名字，而是用户能否带着原来的工作继续往下做。

### 控制按钮必须对应真实状态

另一个测试在 DSH 中中断了 Codex 任务。界面显示任务已经停止，但子进程几秒后仍然
写出了文件。对用户来说，这比没有中断按钮更危险，因为界面给出了错误的确定性。

随后我们修正了进程终止和长命令输出。现在的目标很明确：任务在运行，就应该看到
进度；任务确认停止，相关进程也必须停止。如果插件无法确认清理结果，就应该报告
失败，而不是把界面改成“已取消”。

### 看不见的状态也要验证

敏感值没有出现在聊天记录里，并不代表它没有被保存。验证发现，Codex 的持久 Shell
快照和 Claude 的工具结果都存在写入敏感环境变量值的路径。

Codex `0.1.3` 默认关闭了持久 Shell 快照；Claude `0.1.4` 在工具结果写入历史前
增加了敏感值脱敏。这些修复不能替代最小权限，也不能证明所有第三方工具都安全，
但已经确认的问题不能继续留着。

## 测试不是发布前的一次检查

8 月 29 日的结果没有被放进报告后就结束。第二天发布的两个版本，直接处理了图片
传输、进程中断、长命令输出、敏感值持久化、旧会话导入和工具路由等失败。

这也是我们希望坚持的开发方式：

1. 先在真实项目里使用插件；
2. 把遇到的问题压缩成可以重复执行的用例；
3. 修复插件与 DSH、Codex 或 Claude 之间的边界；
4. 重新运行用例，并保留没有解决的部分。

这套过程比列一张功能清单费时间，但更接近我们想做的东西。`relay-dsh-plugin-codex`
和 `relay-dsh-plugin-claude` 不是为了证明两个后端可以接入 DSH。我们希望它们能承担
真实项目里的连续工作，而且升级后仍然知道自己支持什么、不支持什么。

## 现在仍然有边界

两个插件已经覆盖主要的对话、编码、配置、扩展和会话延续路径，但还不是 Codex 或
Claude Code 原生产品的完整替代品。

目前仍需要继续处理的范围包括：

- DSH 输入框还没有通用文件和文档上传路径；
- 导入的 Codex Thread 或 Claude Session 不适合同时由另一个客户端写入；
- 已存在的 Codex Thread 不能自动刷新后来安装的 DSH 工具；
- Claude 的 CLI fallback 仍是保守的文本路径，不具备 SDK 后端的全部能力；
- 两个新版本修复后的 162 项完整回归还没有形成新的公开矩阵。

这些内容不会从文章里删掉。用户应该按任务需要的能力决定是否迁移，而不是只凭一段
成功视频作判断。

## 安装与项目入口

先停止正在运行的 DSH Web，再按需要安装一个或两个插件：

```bash
dsh plugin --profile web add relay-dsh-plugin-codex@0.1.3
dsh plugin --profile web add relay-dsh-plugin-claude@0.1.4
dsh web
```

- Codex 插件：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-codex) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-codex) ·
  [v0.1.3](https://github.com/yangbobo2021/relay-dsh-plugin-codex/releases/tag/v0.1.3)
- Claude 插件：[GitHub](https://github.com/yangbobo2021/relay-dsh-plugin-claude) ·
  [npm](https://www.npmjs.com/package/relay-dsh-plugin-claude) ·
  [v0.1.4](https://github.com/yangbobo2021/relay-dsh-plugin-claude/releases/tag/v0.1.4)
- Relay：[GitHub](https://github.com/yangbobo2021/Relay) ·
  [中文插件指南](../dsh-plugins.zh.md)
- DeepSeek Harness：[官方仓库](https://github.com/deepseek-ai/deepseek-harness)

我们希望几个月后继续用这两个插件处理项目，而不是只在发布当天录出一段成功视频。
162 项测试不是完成证明，它只是把这件事从“感觉能用”推进到了“知道哪里能用、哪里
还要继续做”。
