# 第四批：继续验收，集中整理问题

按用户要求，本批继续执行其他场景，未因单项失败中止，也未修改插件实现或发布版本。
目标仍为官方 **DSH 0.1.2-alpha.2 / 0a53fb55bea101816fa226bb964ae2bed71c343b**。
本批不能解除全功能发布门槛。集中问题见 [FINAL-ISSUES.zh.md](FINAL-ISSUES.zh.md)，
完整包散列及结果见 [functional-batch-4.json](functional-batch-4.json)。

## 实测结果

| 场景 | 结果 | 实际判据及边界 |
| --- | --- | --- |
| Codex 图片及附件 | passed | 模型读出只存在于合成 PNG 像素中的随机码，不调用工具；附件经 Host 重启后字节 SHA-256、尺寸和浏览器显示一致 |
| Claude 附件保存/重启读取 | passed | 独立于识图断言，640×220 PNG 保存、重启读取及浏览器解码通过 |
| Claude 图片识别 | failed | 两次模型回复图片为 unsupported，不能读码；不能把附件保存通过等同于模型识图通过 |
| Codex fork | passed | 复制已完成历史、子会话记住原标记、新后端绑定、继承附件可读；子回合不追加父历史，父会话不获取子标记 |
| Claude fork | failed | DSH 历史复制通过，但子会话不能回忆原 MEM_ 标记；后续分叉隔离断言未执行 |
| 双后端工作区/附件隔离 | passed | 新 Workspace/Session 绑定独立，来回切换不混入另一会话内容；无关 Session 读取附件被拒绝 |
| Codex 原生导入 | passed | 创建两个真实原生合成 Thread；UI 扫描、取消无绑定、只选一个、进度、未选项不导入；导入后续聊回忆原标记，沿用原 Thread |
| Codex 重复导入 | passed | 已绑定 Thread 被明确拒绝，绑定数量不增加；不要求接口必须返回 existing=1 |
| Claude 程序会话导入边界 | passed | SDK 创建的两个合成 Session 不进入终端历史候选，符合 includeProgrammatic:false。**交互式终端历史的正向导入仍未测** |
| Files 内容及边界 | passed | Unicode、空文件、大文件 UTF-8 截断、二进制/不存在/目录错误；父路径和外部软链接不能读取哨兵文件 |
| Files 浏览器交互 | passed | 代码预览、Markdown 标题/脚注/代码复制、源码/预览切换、隐藏/展开树；切换 Workspace 读取不同文件内容，不残留旧内容 |
| Workbench 尺寸/窄窗口 | passed | 正确面板分隔条将宽度 743→679；关闭面板后 640px 窗口无横向溢出 |
| Workbench 刷新尺寸偏好 | failed | 刷新并重新打开后宽度 679→743；旧、新 Store 均无持久化实现，先按已有能力限制记录，未证明升级回归 |
| Terminal 多终端/Host 清理 | passed | 两个真实 shell PID 不同；Host 停止后两个进程均退出；没有用仅 UI 关闭代替进程检查 |
| Events/Monitors 真实恢复 | passed | Codex 实际调用 relay_schedule_timer；Host 在到期前停止、到期后启动；原会话收到一次 Event 并实际回复，绑定不变；再次重启不重复 |
| Events 管理页 | passed | 新版 Settings 的 Waiting events 列表、Check now、Cancel waits 和确认；取消后不再列为活动等待 |
| Manager 会话确认 | passed | 真实 plugin_manage plan→confirm→DSH 计划卡片；拒绝不改 Profile；批准禁用/启用 Files 后状态正确；确认前均无 Profile 修改 |
| Manager 推荐页 | passed | 新版 Settings 中两个后端推荐及使用说明正常显示 |
| Events/Router/Monitors 确定性回归 | passed | 55/55，包含 HTTP/路由输出和超时、投递恢复、持久计时、观察器边界、降级/rearm、晚加载/卸载/重载及资源清理；不等同于真实路由模型验收 |
| Manager 公开来源 | 部分通过、blocked | npm/GitHub 搜索与检查、npm 安装及三插件批量安装通过；完整生命周期在已发布旧 Codex 启动时报 CallId 缺失，后续未执行 |
| Manager 严格冻结安装 | blocked | 再跑仍被 24 小时 minimumReleaseAge 拒绝，223 项未通过；未添加例外或降低策略 |

## 测试误判的处理

- Claude 原生导入规格明确排除 SDK/headless Session。早期用 SDK 种子期待正向导入不成立，
  已改为独立的“程序会话被排除”验证；不能把该失败登记为扫描缺陷，也不能算终端导入已通过。
- Codex 的重复导入以“拒绝且不新增绑定”通过；早期强制期待 `existing=1` 是错误断言。
- Events 管理列表只返回活动/处理中注册。完成或取消后记录不在列表中是正常语义；
  修正断言后重新实测了到期恢复、第二次重启去重和 UI 取消。
- 浏览器首次启动说明、文件清单创建时机、折叠工作区、隐藏面板和拖拽目标均修正后复核。
  Conversation 的 `data-side=right` 是消息宽度把手，面板应使用 `data-side=details`。
  正确目标下拖拽通过；刷新偏好仍失败，单独保留。
- 某次并发初始化本地依赖链接发生 EEXIST；后续串行启动初始化。
  这些准备/定位失败不作为插件缺陷；原始临时记录没有改写成通过。

## 证据和复现

所有数据均为合成数据。运行使用临时 DSH_HOME、Agent 目录、绑定文件和 SQLite，
没有改用户日常 Profile，也没有发送邮件、外部业务事件或操作客户数据。
真实模型使用已登录的本机认证；原始历史/截图/Host 日志留在临时目录，不复制到 Git。
macOS arm64，Node 25.5.0，Codex CLI 0.149.0，Claude Agent SDK 0.3.251。
候选 tarball 与第三批相同；本批只扩展 Relay 的验收驱动。

| 证据目录 | 用途 |
| --- | --- |
| `/tmp/relay-alpha2-extra-backends2` | 双后端图片、fork、隔离初次完整运行 |
| `/tmp/relay-alpha2-claude-attachments` | Claude 识图与附件保存分别计分 |
| `/tmp/relay-alpha2-import-contract-verified` | Codex 导入/续聊/拒绝重复及 Claude 程序会话边界 |
| `/tmp/relay-alpha2-combined-acceptance` | 文件、多终端、事件真实恢复及管理器确认/推荐页；旧尺寸定位记录已标明被后续替代 |
| `/tmp/relay-alpha2-layout-final` | 正确面板拖拽、刷新偏好、窄窗口 |
| `/tmp/relay-alpha2-events-contracts-batch4.log` | 55 项确定性检查 |
| `/tmp/relay-alpha2-manager-public-live.log` | 公开来源两个 opt-in 用例，原始 1 passed / 1 failed |
| `/tmp/relay-alpha2-manager-frozen-batch4.log` | 严格安装重新执行的策略拒绝 |

机器记录保留 **34 条用例执行记录**，包含重复 smoke、分拆场景和已注明的早期定位失败，
不是 34 个独立功能，也不能据此计算覆盖率。

```sh
# 从 Relay 根目录运行；每次必须使用新的产物目录。先完成一个进程的包/链接初始化，再启动另一个。
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium-headless-shell
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=codex,claude \
  DSH_BACKEND_TASKS=images,fork,isolation,import \
  DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-new-backend-acceptance \
  node scripts/verify-dsh-backend-e2e.mjs
DSH_LIVE_BACKEND_ACCEPTANCE=1 DSH_BACKEND_NAMES=codex \
  DSH_BACKEND_TASKS=workbench,events,manager \
  DSH_BACKEND_ARTIFACT_DIR=/tmp/relay-new-ui-events-manager-acceptance \
  node scripts/verify-dsh-backend-e2e.mjs
node --test integrations/events/test/*.test.mjs integrations/events/test/runtime/*.test.mjs \
  integrations/monitors/test/*.test.mjs integrations/semantic-router/test/*.test.mjs \
  scripts/test/event-plugin-lifecycle.test.mjs scripts/test/event-plugin-composition.test.mjs
```

真实模型用例需要账户额度。失败后驱动继续下一用例；嵌套识图/偏好检查的失败不阻止
附件/窄窗口检查，因此父用例通过不表示所有子用例通过。

仍未执行的关键门槛包括旧附件原地升级、Claude 交互式终端正向导入、Skills/MCP/Hooks、
子代理、外部历史同步及长期故障、管理器会话安装/升级/卸载与跨会话重放、真实语义路由模型、
忙碌/并发会话及真实 admission 故障、复杂 TUI/提供者卸载、Windows/Linux。
此前自动化或受控测试不能替代这些端到端检查。
