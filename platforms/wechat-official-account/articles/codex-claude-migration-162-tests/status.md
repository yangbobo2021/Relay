# 文章状态

Current stage: publish-ready

Artifacts:
- brief: `brief.md`
- draft: `draft-v1.md`
- review: `review-v1.md`，87/100，Revise then publish
- revised draft: `draft-v2.md`
- re-review: `review-v2.md`，94/100，Ready
- title revision: `draft-v3.md`
- title re-review: `review-v3.md`，95/100，Ready
- opening revision: `draft-v4.md`
- opening re-review: `review-v4.md`，96/100，Ready
- publish copy: `publish.md`
- editor package: `editor-package.md`
- AgentPost source: `agentpost.md`
- AgentPost preview: https://agentpost.com.cn/p/g77w4ftcizmkautn
- final WeChat HTML: `wechat-final.html`，Insight Editorial
- layout review: `layout-review.md`，Ready
- body assets: 3 张，其中 2 张真实界面素材、1 张数据图
- data graphic source: `assets/scorecard.html`
- stop comparison source: `assets/stop-comparison.html`

Quality checks:
- 已将跨平台发布说明改写为公众号实测复盘，不机械复制原文结构。
- 首屏用图片未送达和假停止两个真实问题建立阅读动机。
- DSH、Codex、Claude Code、插件均在首次出现时用白话解释。
- 明确说明两个插件是第三方插件，DSH 仍处于开发者预览。
- 162 项数字、167 次运行及两组测试结果与本地完整矩阵一致。
- 明确区分 8 月 29 日测试快照和 8 月 30 日新版本。
- Codex `0.1.3`、Claude `0.1.4` 已通过公开 GitHub Release 和 npm Registry 核对。
- 3 张正文图片尺寸和内容已检查，图片路径完整。
- `publish.md` 无绝对本地路径、Review、TODO、作者指令或私密信息。
- 已在 AgentPost 比较 4 种公众号主题，最终选择 Insight Editorial。
- 已用导出 HTML 完成 390px 手机预览：无横向溢出，3 张图片与 4 个链接均正常。
- 8 月 29 日旧测试快照已改为独立提醒框，避免误读为当前版本通过率。

Remaining blockers:
- 无内容或事实阻塞。
- 正式发布前仍需制作横版封面与方形分享封面。

Next action:
- 按 `editor-package.md` 制作封面；需要发布时使用 `wechat-final.html` 的正文样式。
