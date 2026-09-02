# Relay 邮件插件

该插件接收经过认证的 Gmail 推送通知，推进持久化 Gmail history 游标，通过只读
提供方客户端获取新邮件，生成有边界的规范化证据，并把有关联的邮件线程通过可信
Events 绑定路由。没有可靠关联的邮件交给已配置的语义路由器。

请配置 `RELAY_GMAIL_TOKEN` 和私有的 `RELAY_EMAIL_DATABASE_PATH`。若让 Google
Cloud Pub/Sub 直接投递，还需把 `RELAY_GMAIL_PUSH_AUDIENCE` 设为订阅的 OIDC
Audience，并把 `RELAY_GMAIL_PUSH_SERVICE_ACCOUNT` 设为推送认证服务账号。Relay 会
使用缓存的 Google JWKS 验证 RS256 签名、签发方、Audience、服务账号邮箱、邮箱已验证
声明和有边界的 Token 有效期。

`RELAY_GMAIL_PUSH_TOKEN` 仅用于会注入固定 Bearer Token 的可信网关。Google Pub/Sub
不会发送任意固定 Bearer Token，因此直连必须使用 OIDC 配置。凭证不会被返回、持久化
或写入日志。

也可以在 DSH“设置 → 等待事件”中原子配置或撤销 Gmail API 与网关 Token；部署方
控制的 OIDC 设置在 UI 中只读。同一界面仅展示脱敏连接状态，并可暂停、恢复或断开每个
邮箱。游标和生命周期状态在 Host 重启后仍保留；历史
游标过期时最多补偿同步 500 封邮件，分页中途失败则保留上一个安全检查点。Push 与轮询
并发时按 Gmail message ID 去重。

规范化证据覆盖纯文本/HTML、Unicode、回复、转发、BCC、引用历史、邮件列表、自动回复、
投递失败和有边界的附件元数据。Relay 从不下载或执行附件内容。
