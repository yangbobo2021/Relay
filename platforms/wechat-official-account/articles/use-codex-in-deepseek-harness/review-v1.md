**Publish Decision**

Decision: Revise then publish

Score: 84 / 100

Primary type: 新手实操教程

Secondary type: 工具软推广

One-line judgment: 选题足够窄，第一次出现的术语都有解释，三步可以完成真实任务；固定版本、准备条件和截图聚焦度还需收紧。

**Blocking Issues**

No P0 blockers found.

**Important Fixes**

- P1：安装命令使用 `@latest`，而 DSH 仍处于开发者预览。发布稿应固定到已验证的 `relay-dsh-plugin-codex@0.1.2`，避免文章发布后标签变化导致结果不同。
- P1：“准备三样东西”只给出 `pnpm` 检查方法，没有给出 Node.js 检查命令。应让新手可以逐项确认，而不是凭印象判断。
- P1：第一张截图同时出现 Claude Code，超出本文任务范围。应进一步裁切，只保留模式菜单中的 Codex 及必要上下文。
- P1：应明确本文适用于“已经能打开 DSH 的人”，避免完全没有安装 DSH 的读者误以为一篇文章覆盖所有前置安装。
- P2：“终端没有红色错误”不是稳定的成功标准。可以把“菜单出现 Codex”作为唯一验收结果，并在故障排查中给出插件检查命令。

**Scorecard**

| Dimension | Score | Note |
|---|---:|---|
| Target reader | 9 | 开头和定义面向第一次接触名词的读者 |
| Article promise | 9 | 标题、三步正文和结尾一致 |
| Problem clarity | 8 | 来回切换的问题清楚，但适用前提应更早说明 |
| Structure | 9 | 准备、安装、启动、对话、验收、排错顺序完整 |
| Evidence | 8 | 两张真实截图有效，第一张仍有无关选项 |
| Usefulness | 9 | 有可执行命令、首条提示词和验收方法 |
| Trust | 8 | 说明账号和能力边界，版本标签需固定 |
| Readability | 9 | 段落短，术语有解释，没有架构展开 |
| Distribution fit | 8 | 适合发给刚开始使用 DSH 的用户 |
| Safety | 9 | 建议先只读并使用测试项目 |
| Public-copy readiness | 9 | 正文没有内部路径、TODO 或发布清单 |
| Preconditions | 7 | Node.js 缺少检查命令，DSH 已可运行的前提需前置 |
| Step order | 9 | 顺序可复现 |
| Verification | 8 | 菜单和真实回答形成验收闭环 |
| Troubleshooting | 8 | 覆盖三个高频问题，可增加插件检查命令 |
| Current facts | 8 | 已核对当前版本，但 `@latest` 会漂移 |

**Public-Copy Cleanup**

No public-copy cleanup issues found.

**Suggested Edits**

1. 将安装包从 `@latest` 改为 `@0.1.2`。
2. 在开头增加一句“本文默认你已经能打开 DSH”。
3. 在准备条件中加入 `node --version` 和 `pnpm --version`。
4. 把第一张图裁到只显示 Codex 选项。
5. 在“菜单里没有 Codex”中加入 `plugin ... why` 检查命令。

**Replacement Copy**

开头边界：

> 本文适合已经能打开 DSH、但从未在里面使用过 Codex 的读者。

版本说明：

> 以下步骤在 DSH 0.1.1-rc.2 和 Codex 插件 0.1.2 上验证通过。DSH 仍处于开发者预览阶段，所以命令固定了版本。

**Next Step**

完成上述修订，重新审稿后生成 `publish.md`。
