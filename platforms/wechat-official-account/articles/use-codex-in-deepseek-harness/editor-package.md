# 编辑填写说明

## 基本信息

- 标题：不用来回切软件：在 DSH 里直接用 Codex
- 正文文件：`publish.md`
- 正文图片：2 张
- 图片目录：`assets/`
- 目标读者：已经在使用 Codex、希望在 DSH 中直接建立 Codex 对话的普通用户
- 推荐排版：AgentPost / WeChat / Builder Lab
- AgentPost 预览：`#10`，slug `ehig4fje5vqbsfik`（readonly）
- 带样式富文本：`wechat-builder.html`

## 图片插入位置

### 图片 1

- 文件：`assets/01-select-codex.jpg`
- 图前完整句：再点击 **New Session**。找到输入框上方的 **Standard mode**，点开后选择 **Codex**。
- 图后完整句：看到 Codex 选项，说明插件已经被 DSH 识别。
- 图注：在 DSH 的新建对话菜单中选择 Codex

### 图片 2

- 文件：`assets/02-codex-reply.jpg`
- 图前完整句：如果页面顶部显示 **Codex**，并且它能根据项目内容回答问题，就说明接入成功。
- 图后内容：成功标准提示框。
- 图注：Codex 在 DSH 中读取项目并返回回答

## 发布前逐项检查

1. 使用 AgentPost 的微信公众号 Builder Lab 主题导出富文本，不再把纯 Markdown 直接粘贴到公众号。
2. 确认两张图片已经转换为在线地址，富文本中不存在本地 `assets/` 路径。
3. 在 AgentPost 手机预览中检查标题、小标题、提示框、代码块和图片清晰度。
4. 确认正文只有 2 张图，顺序为选择 Codex、Codex 返回回答。
5. 核对三条主命令：`npx @deepseek-ai/dsh web`、`dsh plugin --profile web add relay-dsh-plugin-codex@latest`、`dsh web`。
6. 公众号草稿中的旧正文基于第二版，不能直接发布；必须用本次导出的富文本整体替换。
