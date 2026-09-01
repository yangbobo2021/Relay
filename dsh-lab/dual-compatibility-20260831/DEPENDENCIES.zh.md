# 候选依赖与发布边界

同一候选版本 `0.2.0-rc.1` 用于新旧两版宿主，不拆分 DSH 专属 dist-tag。
当前没有执行发布、推送、创建标签或提交；线上 `latest` / `next` 不变。

依赖发布顺序（本次不执行）：

1. Session Import、Workbench、Events 先发布共同候选。
2. Codex / Claude 依赖 Session Import；Files / Terminal 使用 Workbench peer；
   Router / Monitors 使用 Events 可选 peer。
3. 所有依赖齐全后验证实际公开源安装与升级，再决定推广标签。

开发依赖使用已推送的契约提交；运行时依赖固定同一候选版，防止组合时混装另一条未验收版本线。
十个插件的 package-lock 已重新生成，并在独立空目录通过 `npm ci --ignore-scripts`。
旧 DSH 不需要先升级管理器才能获得这次运行兼容；自定义 relayCompatibility 白名单、
发布策略检查及旧管理器保护草案已从当前实现撤下。先前草案备份保留在
`.artifacts/dsh-dual-compatibility/`，未发布。
