# 如何看待 DeepSeek Harness 发布？

我的看法很简单：方向是对的，但第一版确实不够好上手。

这个问题下有人把 DSH 形容成“毛坯房”。我觉得挺准确。喜欢折腾的人看到的是自由，普通用户看到的是：为什么装个软件还要先装 Node、打开终端、输入命令，启动以后还得记住一个网页地址？

这不是用户不懂技术，而是产品还没有把这些步骤收好。

DSH 这次发布真正有价值的地方，是它没有把所有能力固定死。今天需要文件浏览，明天需要终端，后天想接 Codex 或 Claude，都可以继续加。问题是，大多数人不想先研究怎么装修，大家只想先把门打开、开始工作。

所以我认为 DSH 接下来最需要补的，不是再增加一批听起来厉害的名词，而是三个很普通的体验：

1. 不装运行环境，不输命令，也能安装；
2. 像普通客户端一样，清楚地启动、停止和打开；
3. 任务跑起来后，人离开电脑也能继续处理。

我做 KeySync，就是在补这一层。用户选择 DeepSeek Harness 后一键安装，完成后在 KeySync Client 里直接管理，不需要知道 Node、端口和启动命令。

![KeySync 一键安装 DSH](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/02-keysync-install-dsh.jpg)

![在客户端里启动、停止和打开 DSH](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-desktop/keysync-client-dsh-running-stop-open.png)

所以这次发布，我不会简单评价为“产品好”或者“产品差”。作为一个开放项目，它的方向很有价值；作为一个直接给普通人使用的软件，它还不够完整。

好消息是，这类缺口不一定都要等官方补。DSH 越开放，越容易出现适合不同人的客户端和插件。最终决定它能不能留下来的，不是发布时有多少 Star，而是半年后还有多少人每天愿意打开它干活。

利益相关说明：KeySync 是我参与开发的第三方产品，不是 DSH 官方桌面版，也不是开源项目。客户端和远程访问目前完全免费。

KeySync 下载：<https://sublang.ai/keysync/download>

DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
