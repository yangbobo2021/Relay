# Relay 的 DeepSeek Harness 插件

[English](dsh-plugins.md) | 中文

> **10 个 Relay 插件现已全部支持最新 DSH `0.1.2-alpha.3`。** 稳定版
> `0.2.1` 已在 `0.1.2-alpha.3`、`0.1.2-alpha.2` 和 `0.1.1-rc.2` 上完成
> 验证。可以安装下方完整套件，也可以只选择需要的能力。

在对话中发现和管理插件，或为官方 DeepSeek Harness 增加 Codex、Claude Code、
工作区文件浏览和交互终端。无需维护 DSH Fork，也不需要修改官方核心代码。

![在官方 DSH 中运行的 Codex 对话与工作区文件](media/dsh-plugin-suite-live.png)

上图来自全新的官方 DSH `0.1.1-rc.2` Profile，展示 Codex App Server 的真实
回复和 Files 视图。同一次 npm 安装验收还验证了 Claude Agent SDK 的真实回复，
以及 Terminal 在 Relay 工作区执行命令的结果。

[观看 Plugin Manager 在 38 秒内安装 Codex](media/dsh-plugin-manager-codex-install-demo.zh.mp4?raw=1) ·
[查看全尺寸实机截图](media/dsh-plugin-suite-live.png) ·
[查看录制与兼容性证据](acceptance/dsh-plugin-demo-qa.md)

## 按需求选择插件

| 你的目标 | 安装内容 | 说明 |
| --- | --- | --- |
| 通过 Chat 查找、安装、更新或删除 DSH 插件 | [`relay-dsh-plugin-manager`](https://github.com/yangbobo2021/relay-dsh-plugin-manager) | 搜索 npm 与 GitHub；每次变更都要单独确认，设置页只提供只读帮助。 |
| 在 DSH 中创建 Codex 对话 | [`relay-dsh-plugin-codex`](https://github.com/yangbobo2021/relay-dsh-plugin-codex) | 基于 Codex App Server 的独立对话后端。 |
| 在 DSH 中创建 Claude Code 对话 | [`relay-dsh-plugin-claude`](https://github.com/yangbobo2021/relay-dsh-plugin-claude) | 基于 Claude Agent SDK 的独立对话后端。 |
| 浏览工作区文件 | [`relay-dsh-plugin-workbench`](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) + [`relay-dsh-plugin-files`](https://github.com/yangbobo2021/relay-dsh-plugin-files) | Files 使用 Workbench 的右侧面板宿主。 |
| 打开终端面板 | Workbench + [`relay-dsh-plugin-terminal`](https://github.com/yangbobo2021/relay-dsh-plugin-terminal) | 如需真实 Shell，再安装 Codex 或其他 provider。 |
| 开发其他右侧或底部视图 | Workbench | 使用公开插件契约，不要导入其他功能插件代码。 |
| 导入已有 Provider 会话 | [`relay-dsh-plugin-session-import`](https://github.com/yangbobo2021/relay-dsh-plugin-session-import) | Codex 与 Claude Provider 共用的会话导入入口。 |
| 将外部事件送回原 DSH Session | [`relay-dsh-plugin-events`](https://github.com/yangbobo2021/relay-dsh-plugin-events) | 持久化 Wait、Event 与 Delivery 运行时。 |
| 监控无法主动推送事件的系统 | Events + [`relay-dsh-plugin-monitors`](https://github.com/yangbobo2021/relay-dsh-plugin-monitors) | 运行受限的持久 Monitor，并产生普通 Relay Event。 |
| 使用 DSH 模型路由事件 | Events + [`relay-dsh-plugin-semantic-router`](https://github.com/yangbobo2021/relay-dsh-plugin-semantic-router) | 可选语义路由，决定 `deliver`、`escalate` 或 `dismiss`。 |

Plugin Manager、Codex 和 Claude 都不依赖 Relay 运行时或 Workbench。Files 和
Terminal 只依赖 Workbench 的公开插件契约。Relay Events 是独立的可选运行时，
这些插件都不要求安装它。

插件管理器可独立安装。首次安装后重启一次 DSH，然后使用 `/plugins` 或普通自然
语言请求：

```bash
npx @deepseek-ai/dsh@0.1.2-alpha.3 plugin --profile web add --save-exact \
  relay-dsh-plugin-manager@0.2.1
```

```text
/plugins 找一个能连接飞书的插件
列出当前插件以及是否需要重启
```

## 从 npm 安装

10 个插件统一使用稳定版 `0.2.1`。npm `latest` 指向 `0.2.1`；`next` 指向
候选版 `0.2.1-rc.1`。

```bash
pnpm dlx @deepseek-ai/dsh@0.1.2-alpha.3 plugin --profile web add \
  relay-dsh-plugin-manager@0.2.1 \
  relay-dsh-plugin-codex@0.2.1 \
  relay-dsh-plugin-claude@0.2.1 \
  relay-dsh-plugin-session-import@0.2.1 \
  relay-dsh-plugin-workbench@0.2.1 \
  relay-dsh-plugin-files@0.2.1 \
  relay-dsh-plugin-terminal@0.2.1 \
  relay-dsh-plugin-events@0.2.1 \
  relay-dsh-plugin-monitors@0.2.1 \
  relay-dsh-plugin-semantic-router@0.2.1

pnpm dlx @deepseek-ai/dsh@0.1.2-alpha.3 web
```

只安装自己需要的插件即可。安装 Files 或 Terminal 时，需要在同一条命令中
明确列出 Workbench。真实交互终端还需要一个 provider；当前这组已发布插件中，
Codex 可以提供该能力。

通过 KeySync 一键安装 DSH 时，Plugin Manager 已经内置安装，不要重复添加。
上面的 npm 命令用于独立安装的官方 DSH Profile。

## 从 GitHub 安装

GitHub 安装适合测试尚未发布的新代码。正式或可复现环境应把 `#main` 替换成
Tag 或完整 Commit SHA。

```bash
pnpm dlx @deepseek-ai/dsh@0.1.2-alpha.3 plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-manager#main \
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
dsh plugin --profile web why relay-dsh-plugin-manager
```

然后新建 DSH 会话，可以先询问“列出已安装插件”，也可以打开 **设置 > 插件 >
插件市场** 查看简短说明。模式菜单中应出现 Codex 和 Claude Code；选择工作区后，
Workbench 菜单中应出现 Files 和 Terminal。

10 个插件仓库均提供中英文安装说明，并记录验证、npm 发布和 GitHub 开发版安装
方式。关于为什么采用这种插件边界，以及完整体验步骤，
可继续阅读
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
KeySync 安装官方 DSH 时已经内置 Plugin Manager；其他可选插件加入三类会话、
Files 和 Terminal，再从手机或另一台电脑回到原会话继续。
