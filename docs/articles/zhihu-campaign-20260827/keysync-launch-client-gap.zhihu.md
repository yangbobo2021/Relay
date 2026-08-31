# 如何评价在 8 月 13 日发布的 DeepSeek Harness？

我觉得这次发布最有意思的，不只是“一切皆插件”，而是它暴露了大家对 Harness 的两种完全不同的期待。

开发者看到的是一套开放的 Agent 运行环境：模型、工具、文件、会话和界面都能继续扩展。很多普通用户期待的却是另一件东西：下载一个客户端，点开就能像 Codex 一样使用。

所以 DSH 发布后才会同时出现两种评价：懂架构的人觉得方向很激进；只想开始使用的人会问，为什么还要装 Node、打开终端、输入命令，最后得到一个本地网页？

我认为这两种评价都对。DSH 的核心有价值，但它距离“小白易用的桌面产品”还差一个入口层。

我现在给 KeySync 的定位就是：一个带远程接力能力的 DSH 桌面版。

它不是 DSH 官方客户端，也没有修改 DSH 的核心。它做的是把官方 DSH 以普通客户端的方式交给用户：

- 不需要单独安装 Node 运行时；
- macOS、Windows、Linux 都能一键安装；
- 安装后在 KeySync Client 里看到 DSH 的版本和运行状态；
- 用“启动、停止、打开”按钮管理，不用记命令和端口；
- 自带对话式插件搜索、安装和管理能力。

![KeySync 中一键安装 DSH](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/02-keysync-install-dsh.jpg)

![KeySync Client 中运行的 DSH](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-desktop/keysync-client-dsh-running-stop-open.png)

这里还有一个普通桌面版不太容易解决的问题：长任务跑起来以后，人离开电脑怎么办？

KeySync 自带安全远程访问。办公室电脑继续运行 DSH，手机、平板或家里的电脑可以回到原来的会话，不需要自建公网服务器，也不用自己折腾内网穿透。目前这部分也是免费的。

![手机上远程打开并继续 DSH](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-desktop/phone-b12-05-1-dsh-opened.png)

所以我对 8 月 13 日这次发布的判断是：DSH 发布的不是一款已经封装完毕的“国产 Codex”，而是一个允许社区继续做客户端、插件和工作流的底座。它当前的安装体验和产品完成度确实还有缺口，但这个缺口未必只能等官方来补。

对开发者，DSH 的价值是可以重组；对普通用户，真正有感知的价值是不用碰环境和命令就能开始使用，并且任务能够跨设备继续。只有这两层接起来，DSH 才会从一个受开发者追捧的开源项目，变成每天有人愿意打开的产品。

利益相关说明：KeySync 是我参与开发的第三方产品，不是 DSH 官方桌面版，也不是开源项目。客户端和远程访问目前都完全免费，没有隐藏收费。

下载地址：<https://sublang.ai/keysync/download>

DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
