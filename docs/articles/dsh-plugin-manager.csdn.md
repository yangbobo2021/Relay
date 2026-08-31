DeepSeek Harness 支持插件，但安装插件通常要先找到正确的包名，再运行命令、检查配置，并判断是否需要重启。

我做了一个独立插件：`relay-dsh-plugin-manager`。安装一次以后，可以直接在 DSH 对话中搜索、安装和管理其他插件。

![Plugin Manager 在 DSH 中搜索、确认并安装 Codex 插件](https://i-blog.csdnimg.cn/direct/69a3a312dbd74f01a73f1847b745987d.gif#pic_center)

_19 秒动图：搜索 Codex 插件、查看安装计划、单独确认，然后完成安装。[查看正常速度的 38 秒 MP4 录像](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/media/dsh-plugin-manager-codex-install-demo.mp4?raw=1)。_

## 它能做什么

直接在对话中说：

```text
找一个工作区文件浏览插件
安装 relay-dsh-plugin-codex
列出已经安装的插件及其状态
停用 example-dsh-plugin
```

Plugin Manager 可以：

- 按功能描述从 npm 和 GitHub 查找 DSH 插件；
- 查看插件来源、版本和基本信息；
- 安装、更新、启用、停用或卸载插件；
- 修改配置前先展示计划，等用户再次确认后才执行。

搜索和查看不会修改 DSH。安装也不会因为一句模糊的要求立刻开始。

## 它和普通插件市场有什么区别

| 普通插件市场 | DSH Plugin Manager |
|---|---|
| 浏览分类和插件列表 | 直接描述需要什么能力 |
| 点击安装按钮 | 在当前对话中提出安装要求 |
| 主要按名称查找 | 可以按自然语言需求搜索 |
| 点击后开始执行 | 先展示计划，再单独确认 |

它不是要替代图形化插件市场。传统市场适合慢慢浏览；Plugin Manager 更适合已经在 DSH 中工作，希望顺手完成查找和安装的人。

## 怎么安装

当前发布的是预览版本。先停止 DSH Web，然后执行：

```bash
dsh plugin --profile web add relay-dsh-plugin-manager@next
dsh web
```

安装管理器本身仍需要这一次命令。之后就可以在 Chat 中管理其他插件。通过 KeySync 一键安装 DSH 时，Plugin Manager 会被自动安装。

当前版本主要管理正在运行的 `web` Profile；部分插件安装后仍需重启 DSH。

## 链接

- [GitHub：relay-dsh-plugin-manager](https://github.com/yangbobo2021/relay-dsh-plugin-manager)
- [npm：relay-dsh-plugin-manager](https://www.npmjs.com/package/relay-dsh-plugin-manager)
- [Relay DSH 插件目录](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.zh.md)
- [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)

这个插件在 Relay 中开发，但可以独立安装到官方 DSH，不需要使用 Relay Fork。
