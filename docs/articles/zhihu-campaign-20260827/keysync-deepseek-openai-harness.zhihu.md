# 如何看待 DeepSeek 和 OpenAI 都开源了各自的 Harness？

我觉得最值得关注的，不是谁先开源、谁开得更彻底，而是大家都在争同一个位置：以后我们通过什么入口让 AI 真正干活。

模型像发动机，Harness 更像驾驶台。普通用户不需要研究驾驶台里面用了什么设计，只会关心三件事：好不好用，能不能换模型，自己的工作能不能留下来继续。

从使用感受看，两条路线各有优势。

Codex 的完成度更高，很多代码任务拿来就能做，少折腾。DSH 目前没有那么成熟，但更方便自己组合：缺什么就加什么，也可以把 Codex、Claude Code 接进来，不必所有任务只用一个 Agent。

我自己的选择不是二选一，而是把它们放在同一个工作入口里：

- 普通任务先在 DSH 里做；
- 大型代码修改交给 Codex；
- 需要另一种思路或审查时切 Claude；
- 文件和终端仍然留在同一个项目现场。

![在 DSH 中按任务选择不同 Agent](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/03-dsh-backend-menu.jpg)

KeySync 负责的是更外面的一层：把 DSH 做成客户端入口，并让这套工作环境能从手机、平板或另一台电脑继续。这样我关心的就不再是哪家公司“赢了”，而是任务能不能稳定做完。

![同一套 Agent 工作环境在不同设备继续](/Users/boboyang/work/IdeaToPost/IdeaToPost-Workspace/outputs/2026-08-26-keysync-dsh-agent-workbench/assets/01-three-device-handoff.png)

所以两家开源 Harness，对用户最大的好处是选择权变多了。以后真正有价值的产品，未必是把用户锁在一个模型里，而是能保存项目现场、按任务切换 Agent，并让工作不中断。

我不认为这意味着所有 Harness 最后都会变成一样。相反，每家仍然会更适合自己的模型和服务。但只要入口越来越开放，用户就更容易保留自己的工作方式，而不是每换一个模型就重新搭一套环境。

利益相关说明：KeySync 是我参与开发的第三方产品，不是 DSH 或 OpenAI 的官方产品，也不是开源项目。客户端和远程访问目前完全免费。

KeySync 下载：<https://sublang.ai/keysync/download>
