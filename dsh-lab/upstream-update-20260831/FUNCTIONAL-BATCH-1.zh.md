# 新版 DSH 第一批功能回归记录

2026-08-31：第一批验证通过，**不代表全部 10 个插件的原功能已经通过验收**。
目标 DSH `0.1.2-alpha.2`，提交 `0a53fb55bea101816fa226bb964ae2bed71c343b`；
执行平台 macOS / arm64，Node `25.5.0`。本批没有调用模型、发布包或修改用户 Profile。

## 已执行

| 用例 | 结果与实际证据 |
| --- | --- |
| UI-B1：六组浏览器组合 | 6/6 通过；官方认证、启动图、资源加载、面板菜单、空态及交互后无浏览器错误 |
| FILES-B1：文本与 Markdown | 新建工作区中的文本筛选/预览、Markdown 标题及正文经真实文件网关显示 |
| TERM-B1：真实终端 | 安装当前 Codex 提供者；命令写出的文件证明 cwd 和中文输入正确；中文/ANSI 输出由实际进程生成，预期文字未直接出现在回显命令中 |
| TERM-B2：resize | 缩小浏览器后，实际 PTY 的 `stty size` 从 `13 158` 变为 `13 128` |
| TERM-B3：Ctrl-C | 实际子进程退出、未发生延迟文件写入；随后 shell 能继续执行命令 |
| TERM-B4：面板恢复与退出 | 重新打开面板后 shell PID 不变且输出历史仍在；输入 `exit` 后检查 shell 进程不存在 |
| MGR-B1：确认门槛 | 计划及无效令牌不修改 Profile、不调用官方安装命令；已消费令牌不能再次执行。覆盖控制器层，不是会话身份校验 |
| MGR-B2：完整受控生命周期 | 真实 manager 候选代码→真实 DSH CLI→本机 registry 的合成包，完成安装、禁用、启用、1.0.0→1.0.1 升级、卸载 |
| MGR-B3：五次冷启动 | 每步启动真实 Host，按正式启动令牌换 Cookie；Web 返回 200，并检查实际加载版本为 1.0.0 / 无 / 1.0.0 / 1.0.1 / 无 |
| MGR-B4：原测试复跑 | 90 项 Vitest + 4 项发布检查通过；2 项公开来源 opt-in 仍未运行 |

证据汇总：[functional-batch-1.json](functional-batch-1.json)，包括候选 tarball SHA-256、
合成包完整性散列、各操作结果及未覆盖范围。测试包的 1.0.0/1.0.1 是临时合成版本，
不是再次发布插件管理器。

## 本批修正的是验收方法

- 原终端“关闭”仅隐藏面板、保留 shell；不能把“关闭面板后进程退出”作为旧功能预期。
  本批分别验证重新打开面板与显式 `exit`，Host 停止及卸载的资源回收另测。
- 测试进程默认 `LC_ALL=C` 会让 zsh 编辑行将中文显示为字节转义，即使输入文件和
  进程输出正确。终端用例明确使用 UTF-8 locale；仅改变隔离测试进程，不更改用户配置。
- 管理器的原公开来源脚本会装已发布旧插件，不能替代当前候选包验收。
  新脚本从候选 tarball 安装管理器，核对控制器与安装产物字节一致，使用真实 CLI。
- 本机 registry 只服务独立 scope 的合成包；每次使用唯一包名，避免 pnpm 缓存让
  下载检查失真。不发布任何包，不修改安装安全策略，不伪造公开包的发布时间。
- 生命周期控制器在 Host 外，正确返回“需要重启”，随后通过真实冷启动验证结果；
  不能据此声称热加载已验收。

## 复现

预先构建官方 checkout 和各插件。Relay 根目录执行：

```sh
DSH_UI_E2E_ARTIFACT_DIR=/tmp/relay-alpha2-functional-ui-full \
  node scripts/verify-dsh-ui-e2e.mjs

# 只验证真实终端、Files 和所需依赖组合
DSH_UI_E2E_SCENARIOS=codex-real-terminal \
DSH_UI_E2E_ARTIFACT_DIR=/tmp/relay-alpha2-functional-ui-utf8 \
  node scripts/verify-dsh-ui-e2e.mjs

cd integrations/dsh-plugin-manager
RELAY_LIFECYCLE_EVIDENCE=/tmp/relay-alpha2-manager-lifecycle.json \
  npm run acceptance:controlled
npm test
```

UI 截图保存在各 `DSH_UI_E2E_ARTIFACT_DIR`，不是仓库中的用户历史副本。
机器记录保留候选包散列；临时 Profile 和工作区均不用于日常 DSH。

## 后续顺序与发布门槛

1. **真实后端关键流程**：Codex/Claude 多轮、模型切换、工具副作用、审批允许/拒绝、
   用户提问、中断后实际停止，分别记录通过/失败，CLI fallback 单独验证。
2. **旧数据与组合**：使用脱敏或合成的旧 Session、附件、Thread 绑定、Wait/Monitor
   副本，执行导入、去重、原地升级、刷新/重启、续聊和多会话隔离；旧组合与新组合
   使用相同用例。不得直接升级用户唯一数据副本。
3. **补齐全部插件目录**：管理器公开来源及真实会话确认/批量/热加载；Workbench/Files
   全交互；Events/Router/Monitors 唤醒、恢复、失败重试及跨 Session 边界。
4. **发布验证**：承诺支持的 OS 的 CI、冻结依赖安装、全插件组合、数据回退演练。
   任一必测项 failed / blocked / not_run 都不能算通过；达标后再提交和发布适配版本。

本批未执行旧版对照、真实模型回合、公开 npm/GitHub 完整生命周期、热加载、旧数据
升级及跨平台 CI，也未重测受新包冷却期阻挡的严格冻结安装。
