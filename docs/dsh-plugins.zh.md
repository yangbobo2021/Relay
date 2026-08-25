# Relay 的 DeepSeek Harness 插件

[English](dsh-plugins.md) | 中文

通过插件为官方 DeepSeek Harness 增加 Codex、Claude Code、工作区文件浏览和
交互终端。无需维护 DSH Fork，也不需要修改官方核心代码。

![Relay DSH 插件套件演示](media/dsh-plugin-suite-demo.gif)

这不是静态页面拼接。演示使用全新的官方 DSH `0.1.1-rc.2` Profile，并从 npm
安装五个正式包：Codex App Server 与 Claude Agent SDK 分别返回真实回复，Files
打开本仓库的 `README.md`，Terminal 在 Relay 工作区实际执行命令。

[播放或下载 H.264 MP4](media/dsh-plugin-suite-demo.mp4?raw=1) ·
[查看全尺寸实机截图](media/dsh-plugin-suite-live.png) ·
[查看录制与兼容性证据](acceptance/dsh-plugin-demo-qa.md)

## 按需求选择插件

| 你的目标 | 安装内容 | 说明 |
| --- | --- | --- |
| 在 DSH 中创建 Codex 对话 | [`relay-dsh-plugin-codex`](https://github.com/yangbobo2021/relay-dsh-plugin-codex) | 基于 Codex App Server 的独立对话后端。 |
| 在 DSH 中创建 Claude Code 对话 | [`relay-dsh-plugin-claude`](https://github.com/yangbobo2021/relay-dsh-plugin-claude) | 基于 Claude Agent SDK 的独立对话后端。 |
| 浏览工作区文件 | [`relay-dsh-plugin-workbench`](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) + [`relay-dsh-plugin-files`](https://github.com/yangbobo2021/relay-dsh-plugin-files) | Files 使用 Workbench 的右侧面板宿主。 |
| 打开终端面板 | Workbench + [`relay-dsh-plugin-terminal`](https://github.com/yangbobo2021/relay-dsh-plugin-terminal) | 如需真实 Shell，再安装 Codex 或其他 provider。 |
| 开发其他右侧或底部视图 | Workbench | 使用公开插件契约，不要导入其他功能插件代码。 |

Codex 和 Claude 插件不依赖 Relay Events 或 Workbench。Files 和 Terminal 只
依赖 Workbench 的公开插件契约。Relay Events 是独立的可选运行时，本页任一
插件都不要求安装它。

## 从 npm 安装

DSH 仍处于预览阶段，两个对话后端当前推荐使用已经通过测试的候选版本；
Workbench 系列插件使用稳定版。

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@next \
  relay-dsh-plugin-claude@next \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest

pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 web
```

只安装自己需要的插件即可。安装 Files 或 Terminal 时，需要在同一条命令中
明确列出 Workbench。真实交互终端还需要一个 provider；当前这组已发布插件中，
Codex 可以提供该能力。

## 从 GitHub 安装

GitHub 安装适合测试尚未发布的新代码。正式或可复现环境应把 `#main` 替换成
Tag 或完整 Commit SHA。

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-codex#main \
  github:yangbobo2021/relay-dsh-plugin-claude#main \
  github:yangbobo2021/relay-dsh-plugin-workbench#main \
  github:yangbobo2021/relay-dsh-plugin-files#main \
  github:yangbobo2021/relay-dsh-plugin-terminal#main
```

安装、更新或删除插件后，请重启 DSH Web。

## 验证安装结果

```bash
dsh plugin --profile web why relay-dsh-plugin-codex
dsh plugin --profile web why relay-dsh-plugin-claude
dsh plugin --profile web why relay-dsh-plugin-files
dsh plugin --profile web why relay-dsh-plugin-terminal
```

然后新建 DSH 会话：模式菜单中应出现 Codex 和 Claude Code；选择工作区后，
Workbench 菜单中应出现 Files 和 Terminal。

每个独立仓库都提供中英文安装说明、故障排查、针对固定官方 DSH Commit 的 CI、
基于 Tag 的 npm 发布流程和 GitHub 开发版安装方式。关于为什么采用这种插件边界，
以及完整体验步骤，可继续阅读
[《不改 DSH 核心：用插件加入 Codex、Claude Code、文件浏览和终端》](articles/no-fork-dsh-plugins.zh.md)。

Codex 插件还把 App Server 可靠性作为产品契约：Settings 状态会区分启动、连接、
运行时不可用和重新绑定问题；空白 Session 的模型选择会跟随当前后端；正常 fork
会调用 App Server `thread/fork`；无效的 fork 来源信息或过期 approval 会 fail
closed，不会静默创建替代 Codex Thread。

如果更关心实际工作方式，而不是包结构，请阅读
[《把 DSH 变成多 Agent 项目工作台》系列](articles/dsh-agent-workbench-series.zh.md)：
从 DSH 原生、Codex、Claude 的任务选择开始，再分别进入 App Server、Claude
Session、项目 Workbench 和未来协调边界。

多设备完整实测见
[《电脑没带走，AI 工作没停》](articles/keysync-dsh-multi-device-agent-workbench.zh.md)：
KeySync 安装官方 DSH，插件加入三类会话、Files 和 Terminal，再从手机或另一台
电脑回到原会话继续。
