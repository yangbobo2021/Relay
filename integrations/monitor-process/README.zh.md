# Relay Process Monitor Capability

本扩展为 Agent 自定义 Relay Monitor Bundle 提供只读、身份安全的进程状态能力。它不会
预注册 Bundle Type：Agent 在目录中找不到进程类型后，先签发已授权的 Process Handle，
再通过 `relay-monitor-author` Skill 创建任务范围的临时 Bundle。
