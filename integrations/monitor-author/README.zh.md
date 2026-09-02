# Relay Monitor Author

这是一个 Codex Skill 插件，用于查询 Relay 实时 Monitor Bundle 目录，并安全地安装
插件预置或 Agent 临时编写的 Bundle。

安装此插件目录后，可以让 Agent 等待外部条件。Skill 依赖 Relay Monitor Core 工具；
只有相关能力插件真实安装后，才会调用例如 `relay_issue_process_handle` 的可选工具。
