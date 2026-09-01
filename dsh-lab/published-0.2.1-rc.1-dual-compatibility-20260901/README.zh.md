# 已发布候选包的双版本 DSH 验收

本次验收直接从 npm registry 下载十个插件的 `0.2.1-rc.1`，使用同一批 tarball 分别安装到两个官方 DSH 宿主：

- DSH `0.1.1-rc.2`，官方标签 `dsh-v0.1.1-rc.2`，提交 `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。
- DSH `0.1.2-alpha.3`，官方标签 `dsh-v0.1.2-alpha.3`，提交 `dd6322d604e00eec1ba5e0c8541159906a21094a`。

npm 标签在验收时为 `next → 0.2.1-rc.1`、`latest → 0.2.1`。两次运行记录的十个插件 tarball SHA-256 完全一致，证明测试的确覆盖同一批已发布候选包，而不是本地构建产物。

## 结果

旧版 16/16、新版 16/16，共 **32/32** 场景通过。覆盖范围包括：

- Manager、Session Import、Events、Router、Monitors 等单插件加载。
- Codex、Claude 单独及组合创建和打开 Session，Codex 预设与模型同步。
- Workbench 挂载动作；Files 文件树、Markdown/源码切换、拖拽和关闭重开。
- Terminal 创建、输入、输出、调整尺寸和退出；缺少提供者时稳定返回错误。
- Events HTTP 去重和错误请求处理，以及 Events、Router、Monitors 受控回放。
- 十个插件全部同时安装、启动和加载的全集成场景。

逐包哈希、逐场景结果和具体功能探针见 [verification.json](verification.json)。

## 结论边界

本结果确认 `0.2.1-rc.1` 在上述自动化覆盖内同时兼容 DSH `0.1.1-rc.2` 和 `0.1.2-alpha.3`。以下项目不在本次验收范围内：

1. Claude 真实图片识别与 fork 上下文继承。
2. Codex Default 模式的原生提问卡片限制。
3. Workbench 刷新后面板尺寸持久化。
4. 真实模型端到端对话、跨平台和长期并发。

部分 Codex 组合安装仍显示既有的 `lucide-react` React peer 警告。DSH 通过客户端模块表提供 React，两个宿主上的浏览器加载与功能探针均通过，因此该警告未构成运行冲突。
