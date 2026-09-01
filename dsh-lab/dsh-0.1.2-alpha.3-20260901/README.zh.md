# DSH 0.1.2-alpha.3 插件兼容性复核

本次复核使用官方标签 `dsh-v0.1.2-alpha.3`，对应提交
`dd6322d604e00eec1ba5e0c8541159906a21094a`。比较基线为
`0.1.2-alpha.2` / `0a53fb55bea101816fa226bb964ae2bed71c343b`。

## 上游变化

两个版本之间前进 117 个提交，共有 1034 个文件发生变化，其中大量文件是全仓版本号、
发布文档和测试快照。影响产品行为的主要修改为：

- 长会话右侧导航可预览并跳转到尚未载入的分页轮次。
- 降低长会话渲染的内存占用，并延迟屏幕外代码的语法高亮。
- 修复运行中追加、排队图片的回显与投递；持续子代理的后续消息支持图片。
- `read_image` 可按内容识别无扩展名的图片附件路径。
- 命令菜单打开时，`Tab` 可补全当前高亮的斜杠命令。
- 后端暂时卡顿不再被连接层误判为断开。
- 修复窄视口下 Schedule 列表偏移或越界。
- 删除可选的 DSH SQLite Session 持久化后端，保留 JSONL 路径。

官方发布说明：<https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.3>

## 与 Relay 插件边界的关系

Relay 插件直接使用的 Host 服务包中，Agent、Remotes、Workspace Controller、LLM、Session、
Tools、Typert Protocol、Commands 和 User Questions 的实现接口没有变化。发生变化的直接依赖
主要是 Session Controller、Connection、Conversation、Chat、UI Primitives 和 UI Tool 客户端包。
这些变化以新增会话导航、图片提交状态和宿主内部渲染优化为主；Relay 插件没有调用新增了必填
`mode` 的 `beginSubmission` 接口。

DSH 删除 SQLite Session 持久化不会影响 Relay。十个插件均不依赖被删除的
`@deepseek-ai/dsh-session-persistence-sqlite`；Events 使用的是插件自己管理的 `node:sqlite`
数据库，与 DSH 会话持久化后端不是同一组件。

十个插件声明的 DSH peer 范围为
`>=0.1.2-alpha.2 <0.1.3-0`（以及对应旧版范围），因此 semver 允许安装在 `alpha.3`。
全集成 profile 的 `pnpm peers check` 只报告 `lucide-react` 缺少普通 React peer；DSH Web
通过客户端模块表提供 React，浏览器加载与 Codex UI 探针均通过。这条警告在此前宿主组合中也存在，
不是 `alpha.3` 引入的 DSH 版本冲突。

## 实测结果

官方 `alpha.3` 源码构建成功。随后直接从 npm registry 下载十个已发布的 `0.2.0` 包，
安装到 16 个相互隔离的临时 DSH Web profile 中；16/16 场景通过：

- 十插件分别及依赖组合可以安装、解析 peer、生成配置、启动 Host、加载浏览器资源。
- Codex/Claude 客户端注册正常，可以创建并打开 Session；Codex 预设与模型同步正常。
- Workbench 动作正常；Files 的文件树、Markdown/源码切换、拖拽及关闭重开正常。
- Terminal 的创建、输入、输出、调整尺寸和退出正常；缺少提供者时能稳定返回错误。
- Events HTTP 去重与错误请求处理正常；Events、Router、Monitors 受控回放通过。
- 十插件全集成场景启动并通过全部上述功能探针。

已发布的 Manager `0.2.0` 还单独完成安装、禁用、启用、升级和卸载流程；每次冷启动均加载
预期版本，未确认操作不会执行，确认令牌不能重放。

十个插件随后直接链接官方 `alpha.3` 声明与构建产物执行各自的 `npm run verify`，10/10 通过；
Relay 根测试 450/450 通过。Codex 最初有 21 个组件测试失败，原因是测试夹具未调用
`alpha.3` 新增的按需 `activateTarget('chat')`。夹具改为能力探测后同时兼容 `alpha.2` 和
`alpha.3`，Codex 的 250 个 Node 测试与 140 个组件测试全部通过。这个修复只改变测试，
不改变已发布插件运行时代码。

逐包 SHA-256、逐场景结果和管理器生命周期证据见 [verification.json](verification.json)；
上游边界分析见 [upstream-changes.json](upstream-changes.json)。

## 结论边界

十个已发布插件 `0.2.0` 与 DSH `0.1.2-alpha.3` 在现有自动化覆盖的安装、加载、组合和核心
功能范围内兼容，不需要修改运行时代码。

“完全兼容”不能扩大解释为所有历史功能均已实测。此前明确暂缓或未关闭的项目仍然存在：

1. Claude 真实图片识别与 fork 上下文继承。
2. Codex Default 模式的原生提问卡片限制。
3. Workbench 刷新后面板尺寸持久化。
4. 真实模型端到端交互、跨平台和长期并发不由本次受控验收替代。
