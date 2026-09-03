# Relay GitHub 插件

Relay GitHub 插件负责校验签名 Webhook、归一化拉取请求状态变化、提供只读 PR
监控观察器，并为经过认证的根 Agent 提供
`relay_watch_github_pull_request` 操作。

`0.2.0` 同时也是 Monitor Bundle 扩展：它向 Monitor Core `0.3.1` 动态注册双语的
`github.pull-request` Type 和 `github.pull-request.read` Provider。实时目录会区分已授权且
可用的配置与仍需配置的状态。Webhook Connector 继续作为推送路径，并通过相同的状态
变化关联键与轮询结果收敛。

本包已在 DSH `0.1.2-rc.1` 上完成验证，同时保留对已审计
`0.1.2-alpha.3` 运行时的兼容。

请配置至少 16 个字符的 `RELAY_GITHUB_WEBHOOK_SECRET`，如需轮询再配置
`RELAY_GITHUB_TOKEN`。Webhook 地址为 `/api/relay/github/webhook`。API Token
只需具备目标仓库、拉取请求、检查和评审的读取权限。

插件不会从工具参数接受 Session ID，不会记录或返回密钥，也不会执行 GitHub
写操作。

DSH“设置 → 等待事件”会展示 Webhook/API 健康状态，并支持当前/上一密钥重叠的安全
轮换和立即撤销；密钥始终只写且脱敏。多项目主机可通过 `projects` 配置绝对项目根目录、
仓库允许列表和 DSH 凭证句柄。Relay 仅按真实路径边界选择最长匹配项目，绝不会回退到
其他项目的 Token。

只读 API 观察会完整读取检查和评审分页，最多 5 页或 500 项，并拒绝离开已配置
API origin/path 的下一页链接。仓库迁移、删除、不可用和身份变化会返回不同的可操作状态。
