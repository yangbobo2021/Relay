# Codex Plugin Hook 信任传递根因定位

定位日期：2026-08-30。

## 结论

`CDX-EXT-014` 的失败不是插件包缺失，也不是 `Bash` matcher 不匹配。
问题是：操作者在 App Server **进程启动参数**中显式指定了
`--dangerously-bypass-hook-trust`，但旧 Relay 接入没有把这个运行例外传到
**Thread 配置**。在该版本的 App Server 中，创建 Thread 时重新构造配置，
未获持久信任的 Hook 因此仍被跳过。

2026-08-30 03:04 CST 已有修复
[`41275a3`](https://github.com/yangbobo2021/relay-dsh-plugin-codex/commit/41275a350c2e7034761703f1ca8b39af3475e2a8)：
仅当操作者传入精确的独立启动标志时，将 `config.bypass_hook_trust: true`
传入 `thread/start`、`thread/fork` 和 `thread/resume`。本地 Git 证明
`v0.1.3`、`v0.1.4` 均包含该提交。此次未重复修改生产代码。

这项修复不是默认信任所有插件，更不代表已经实现 DSH 中的完整 Hook 审查界面。

## 为什么旧报告的解释不充分

旧报告观察到两个真实现象：DSH 路径没有 Hook 日志，目标文件实际生成。
但随后由“进程参数中已有绕过标志”推断“已经排除信任问题”，这一步不成立：
进程启动设置和每个 Thread 的有效配置并不是同一层。

当时写下的“App Server 路径不加载插件 Hook”属于过宽的根因解释，应更正为
“显式 Hook 信任例外未传递至 Thread，导致未信任的 Hook 未执行”。
历史测试的失败结果保留；不能据此声称当前版本或所有 App Server 均不支持 Hook。

## 本次复现实验

- 真实执行引擎：插件依赖的 `codex-cli 0.149.0`。
- Relay Codex 当前检出：`cac79dd`，包版本 `0.1.4`。
- 每组都有全新 `HOME`、`CODEX_HOME`、工作目录和同构的测试插件缓存。
- 采用上游测试中的本地 Responses SSE stub 方式，固定返回一条
  `exec_command` 调用，再返回结束消息；没有真实模型推理或账号凭据。
- 仅写入临时目录的 `blocked.txt`。Hook 匹配带 `HOOK_BLOCK_PROBE` 的调用并拒绝。
- 同时注册 `SessionStart` 和 `PreToolUse` 记录探针。
- 使用真实 `hooks/list` 检查发现状态，使用 Hook 输入日志、协议通知和文件存在性
  判断是否执行，不依赖模型文字声称。
- 结果见 [results.json](results.json)，脚本见 [probe.mjs](probe.mjs)。

| 对照组 | 插件 Hook 已被发现 | Hook 执行 | 测试文件生成 |
| --- | --- | --- | --- |
| CLI + 显式启动信任例外 | 运行日志证明来自安装缓存 | 是，拦截 | 否 |
| 独立 App Server，仅启动标志 | 是，2 项 enabled Hook | 否 | 是 |
| 上一组改为匹配所有工具 | 是，2 项 enabled Hook | 否 | 是 |
| App Server，启动标志 + Thread 信任例外 | 是 | 是，拦截 | 否 |
| App Server，仅 Thread 信任例外 | 是 | 是，拦截 | 否 |
| 当前 Relay runtime + 显式启动标志 | 是；runtime 自动补 Thread 配置 | 是，拦截 | 否 |
| 当前 Relay runtime，默认设置且 Hook 未信任 | 是 | 否，符合未信任策略 | 是 |

七组均通过脚本断言。所有成功拦截组都收到 `PreToolUse` / `Bash`，命令结果含
`RELAY_HOOK_TRUST_PROBE_BLOCKED`，目标文件不存在。启动标志失败组即使使用 `*`
matcher，连 `SessionStart` 都没有执行，进一步排除了仅工具名匹配错误。

`hooks/list` 在这些新环境中始终显示 `trustStatus: untrusted`，因为探针没有写入
持久信任记录。该列表不是某个 Thread 临时信任例外的执行证明；Thread 级效果
由实际 Hook 事件和拦截结果证明。

## 与真实 DSH 回归记录的对应

此次新实验直接调用真实 CLI、App Server 和插件的
`CodexAppServerClient` / `CodexSessionRuntime`，没有重新启动完整 DSH Web。
它针对配置传递做确定性定位，不是新一轮 162 项验收。

已有修复的 [C7 验收记录](../../integrations/codex/docs/reliability-acceptance.md)
还记载：原失败 DSH Session `session-9d70e178-3052-42df-88ff-6c74dcb127ad`
和原 Codex Thread `01a04c01-0890-7392-b74b-794c578c20f3` 在修复后经 code mode
触发了 `hook/started` 和 blocked `hook/completed`，且未生成目标文件。
本次复核了保留的 after-fix / final Hook 日志：它们来自原测试插件的同一安装
版本 `0.1.0+codex.20260829052923`，工具名都是 `Bash`。这些属于历史回归证据，
不冒充本次新运行。

本次另外执行了两个相关测试文件，共 31 项通过，包括默认不启用信任例外、
不把参数子串误判为独立标志，以及 start/fork/resume 三种请求的配置传递。

## 安全含义与边界

- 未获信任的 Hook 默认不运行，是 Codex 的策略，不是本次修复要消除的限制。
- 安装或启用插件不等于信任其 Hook。
- 修复只补齐操作者已经明确要求的临时例外；它不能替代用户审查和按定义信任。
- 此次没有测试持久信任交互、HOL Guard 或所有工具路径，也没有宣称它们全部兼容。
- Hook 属于执行前扩展机制，不能代替沙箱、最小权限或完整安全隔离。

官方依据：[Hooks 文档](https://learn.chatgpt.com/docs/hooks)说明插件 Hook 的发现、
按定义信任、未信任时跳过、matcher 规则，以及临时信任绕过的用途。
运行实验固定使用 `0.149.0`；文档可能随版本变化，实测结果优先用于此次历史定位。

## 复现

在 Relay 根目录，确保 `integrations/codex` 的现有依赖已安装：

```sh
node dsh-lab/codex-hook-trust/probe.mjs /tmp/relay-hook-trust-results.json
node --test integrations/codex/test/app-server-client.test.mjs integrations/codex/test/session-runtime.test.mjs
```

脚本退出时关闭本地 HTTP server 和测试 App Server。原始合成事件保留在启动时
打印的临时目录，汇总结果将环境路径替换为 `<RUN_ROOT>` / `<NODE>`。
脚本不会读取、复制或修改真实用户的 Codex 配置和认证文件。
