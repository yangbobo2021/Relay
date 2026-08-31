# DeepSeek Harness 已发布，如何评价这款产品？

我的评价是：DSH 的框架思路很强，但它现在更像一套正在高速生长的 Agent 工作台，还不是一款把普通用户体验全部包好的桌面产品。

这个问题下很多回答都在讨论“一切皆插件”、Agent Loop、Session Log，这些确实是 DSH 最有价值的地方。但从真实使用看，用户最先碰到的往往不是架构，而是三个更具体的问题：怎么装，怎么日常打开，人离开电脑后怎么继续。

官方 Web UI 并不是缺点，它让 DSH 很容易被扩展，也天然适合在不同设备上访问。问题在于，官方入口仍然要求用户理解 Node、终端命令和本地服务。对开发者没什么，对普通用户就是一道明显的产品化缺口。

我因此把自己做的 KeySync 定位成：一个带远程接力能力的 DSH 桌面版。

这里的“桌面版”不是把网页简单套个壳，而是把 DSH 日常使用需要的入口补齐：

- 不需要用户另装 Node，也不需要输入安装命令；
- macOS、Windows、Linux 一键安装 DSH；
- 在 KeySync Client 里用按钮启动、停止和打开；
- 自带对话式插件搜索、安装和管理；
- 手机或另一台电脑可以远程回到原来的 DSH 会话。

![KeySync 客户端中的 DSH 运行状态和操作按钮](/Users/boboyang/work/Relay/docs/articles/zhihu-campaign-20260827/assets/keysync-dsh-desktop/keysync-client-dsh-running-stop-open.png)

我认为这也解释了 DSH 为什么选择 Web UI。它把核心做成开放工作台，客户端、插件管理、远程访问可以由不同产品在外层补足。对生态来说，这比把所有能力都焊死在一个官方客户端里更灵活；对最终用户来说，前提是有人把这些能力组合成真正可用的入口。

KeySync 还会把 DSH、Codex、Claude Code 放在同一个客户端里管理。原因很现实：DSH 有些任务做得很好，但有些复杂开发、审查或特定工作流，我仍然会切到更成熟的 Agent。与其争论谁完全取代谁，不如让 DSH 负责开放工作台，让不同 Agent 在需要时接进来。

![KeySync 在多设备间延续同一套 Agent 工作环境](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/01-three-device-handoff.png)

真正让我看好 DSH 的，不只是它能不能生成一段代码，而是它有机会变成一个长期运行、持续增加能力的工作入口。插件决定它能做什么，客户端决定普通人愿不愿意每天打开它，远程接力决定长任务能不能进入真实生活。

所以如果只评价当前完成度，我会说它仍然偏早期；如果评价方向，我会说它比“再做一个封闭的 AI 编程客户端”更有想象空间。现在最缺的不是再解释一次架构，而是把安装、管理、插件发现和跨设备使用做得足够自然。

利益相关说明：KeySync 是我参与开发的第三方产品，不是 DSH 官方客户端，也不是开源项目。KeySync 客户端和远程访问目前都完全免费。

下载地址：<https://sublang.ai/keysync/download>

DeepSeek Harness 官方仓库：<https://github.com/deepseek-ai/deepseek-harness>
