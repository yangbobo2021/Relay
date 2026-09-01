# 同包兼容两版 DSH

本轮按用户要求改为同一插件包兼容旧、新宿主；不维护 DSH 专属发布通道，不依赖旧用户升级管理器。
**最终结果：旧版 16/16、新版 16/16，共 32/32 场景通过；十个插件同包验证完成。**
包哈希及逐场景结果见 [verification.json](verification.json)。源码、包元数据和文档在
`codex/dsh-dual-compatibility` 分支，当前未提交、推送或发布。

## 两个测试宿主

| 宿主 | 官方版本与提交 | 使用方式 |
| --- | --- | --- |
| 旧版 | `0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` | 只读使用本机已安装的官方 CLI |
| 新版 | `0.1.2-alpha.2` / `0a53fb55bea101816fa226bb964ae2bed71c343b` | 只读使用官方 checkout 的 CLI 构建产物 |

每个场景使用独立临时 DSH_HOME、workspace、端口及浏览器上下文。测试运行平台为 macOS arm64，
Node 25.5.0。同一轮先打包一次，再把相同 tarball 装到两版；SHA-256 在结果文件中保留。
官方源码、日常 3080 环境和 56582 体验环境均不修改。

## 实际修复

| 插件 | 差异和处理 |
| --- | --- |
| Codex | 兼容 `ToolCallId` / `CallId`；兼容旧/新会话预设字段、事件服务与聊天状态 hook；过程视图沿用实际 locale；Markdown 同时传递两套标签。仍保留新版原生过程折叠的退让逻辑 |
| Claude | 兼容导入历史的工具 ID、前端事件注册和预设字段。没有运行真实识图或 fork |
| Workbench | 旧版使用宿主 runtime 的 Store，新版使用独立 Store；禁止把旧 runtime 打进插件；旧版 root 已提供会话上下文，新版通过独立 SessionProvider 提供，按 uiSession 能力选择 |
| Files | Markdown 同时满足新旧组件参数，保留源码/预览、关闭重开行为 |
| Terminal、Manager、Session Import、Events、Router、Monitors | 原有业务实现不需要额外宿主分支；更新共同候选声明、依赖与验证。管理器验收脚本支持两种认证启动方式 |

类型检查使用新版官方声明，运行测试覆盖旧、新两版。兼容逻辑按实际接口能力选择路径，
没有把运行时逻辑写成版本字符串白名单。
详细变更文件清单见 [changes.json](changes.json)，依赖与发布安排见 [DEPENDENCIES.zh.md](DEPENDENCIES.zh.md)。

## 验收覆盖

- 十插件分别执行 `npm run verify`：类型/语法、单元/组件、构建与各自验收。
  Codex 250 个 Node 测试及 140 个组件测试；Claude 135 + 5；管理器 90 + 4（2 个真实 Codex 用例跳过）。
- Relay 总回归 450 项通过；这与插件自身测试有重叠，不应相加当成独立用例数量。
- 十个独立空目录均通过 `npm ci --ignore-scripts`；三个事件插件的独立打包公共入口检查通过。
- 浏览器核心功能：插件注册实际生效、创建/打开 Session、Codex 预设/模型同步、Workbench 动作、
  Files 文件树/Markdown/源码切换/面板拖拽/关闭重开、Terminal 创建/输入/输出/调整尺寸/退出。
- 未安装终端提供者时，Terminal 正确提示 `provider-unavailable`；可执行终端用 Codex 提供者组合验证。
- Events 实际 HTTP 去重、无匹配隔离及错误请求；受控语义路由、定时器、重复事件不重投与原会话继续。
- 管理器：相同候选 tarball 在两版完成受控安装、禁用、启用、升级、卸载；每步冷启动验证实际加载版本，
  并检查未经确认不能执行及确认令牌不能重放。结果见 manager-old.json / manager-new.json。

单独 Files 场景会出现官方首次配置遮罩；测试点击“Configure later”，不读取或配置密钥。
面板拖拽在足够宽的视口验证，避免把最小中心宽度的正常约束误报成拖拽故障。

## 未关闭的问题与范围

1. Claude 真实图片识别、fork 上下文继承：按用户要求暂缓。
2. Codex Default 模式的原生提问卡片限制：未关闭；本轮没有声称模式限制已经解决。
3. Workbench 刷新后尺寸不保留：两代状态逻辑都缺少持久化，本次未新增此功能。
4. 完整真实模型业务、Claude 交互式终端历史导入、公开 npm/GitHub 发布后升级、跨平台、
   长期并发、外部系统故障恢复等，不由本轮受控兼容测试代替。管理器两项 live 测试没有计算为通过。

本轮结论是这两版上的已验证核心兼容，不是“所有历史功能与未来版本都保证可用”。
历史 B-03（旧版因 ToolCallId 缺失无法启动）由此次同包适配解决；此前白名单和独立通道方案已经撤下。

## 复跑

在 Relay 根目录、十个插件完成构建后执行：

```sh
DSH_LEGACY_BIN=/absolute/path/to/old-official-dsh/lib/bin.js \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell \
node scripts/verify-dsh-official-install.mjs
```

新宿主默认使用 `upstream/deepseek-harness/apps/cli/lib/bin.js`。可用 DSH_INSTALL_SCENARIOS
选择个别场景。验收夹具仅安装在临时 profile，不包含在发布的十个插件里。
