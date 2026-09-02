# Relay Monitor Author

这是一个 DeepSeek Harness 插件。它把 `relay-monitor-author` Skill 注册到 DSH
原生 Skill 目录，指导当前 DSH Agent 查询实时 Monitor Bundle、优先使用插件类型，
并在确实没有匹配类型时，以最小权限创建、验证和安装临时 Bundle。

请与 `relay-dsh-plugin-monitors` 一起安装。用户可以直接告诉 DSH Agent 等待某个
外部条件，也可以通过 DSH 原生 Skill UI／工具加载 Skill，或显式调用
`/relay-monitor-author`。所有创建操作都通过绑定当前 DSH 根 Session 的 Monitor
工具完成；本包不是 Codex 插件，也不会绕过 Relay 授权。

卸载本插件后，该 Skill 会从后续 DSH 目录结果中消失；已经由 Monitor Core 持久化
的 Monitor 不会被停止或改写。

具体契约见 [SPEC.md](SPEC.md) 和
[docs/acceptance-scenarios.md](docs/acceptance-scenarios.md)。
