# 当前修改提交合并检查点

日期：2026-08-31。官方 DSH 基线：`0.1.2-alpha.2` / `0a53fb55bea101816fa226bb964ae2bed71c343b`。

本检查点保存现有修改，不构成发布验收通过。插件版本和 npm 标签均不变；兼容保护尚未实现，现有功能问题继续见 [FINAL-ISSUES.zh.md](FINAL-ISSUES.zh.md)。

## 本次复核

- 10 个插件各自的 `npm run verify` 和 `npm pack --dry-run --ignore-scripts` 均成功。
- Relay 36 项契约/边界检查及完整 `npm test` 全部通过；同步了仍要求旧 DSH peer 范围的过时断言。
- 16 个官方 DSH 隔离安装组合全部通过，包括单插件、组合和全部插件。
- 本次没有调用真实模型；没有补跑用户暂缓的 Claude 图片识别和 fork 上下文验收。
- 官方源码保持未修改；日常 3080 和体验 56582 环境未重启。
- 文本凭据模式扫描未发现命中；原始本地配置、运行日志及临时捕获素材不入库。

## 插件提交

| 仓库 | 当前版本（未发布新版本） | 提交 |
| --- | --- | --- |
| claude | `0.1.5` | `e216e553a1f71fd4b2397832c55083a9ea146d06` |
| codex | `0.1.6-rc.1` | `c4fb2d74d4511e3e3a16b27d22aafd86abf6dc02` |
| dsh-files | `0.1.0` | `2360b6faa532c6cf54dd423bd2130ddf05d853b7` |
| dsh-plugin-manager | `0.1.1` | `f2d81138b522aa48d4976b2f0fe77e2a493972ef` |
| dsh-terminal | `0.1.1` | `70b2fc1483b6d4c60929bd3b6d269d726a85ec3d` |
| dsh-workbench | `0.1.0` | `f95cb78d64c7eea7c95007ccfc928fbfc4bc8711` |
| events | `0.1.0-internal.2` | `aabf30362ee0e5d374a1f1d6ae1b1f7be8553c6a` |
| monitors | `0.1.0-internal.2` | `f07657e23dfde45dab1a9a22dfd680ac7dd2da7c` |
| semantic-router | `0.1.0-internal.2` | `dadfa8044c8a55a28b9b13a86dd592a7237ce046` |
| session-import | `0.1.0` | `65417a5abd365d19c619c8a1c1679768189a68e4` |

插件提交先合并推送到各自 `main`，Relay 再记录这些已推送的 Git 引用。插件的既有未合并外部 PR（Codex #27）不包含在本次整理中。

## 本地保留而不入库的内容

- 根目录 `.tmp-*`，录屏目录的 raw/source/qa 中间产物。
- Codex 临时截图；Claude 测试运行配置目录和原始 JSONL 日志。
- 两个动态生成的测试 Git 仓库及一个无效的 Session Import 自引用软链接。
- 已备份的原始差异、验证日志和根 package.json 的自动膨胀版本位于忽略目录 `.artifacts/commit-cleanup-20260831/`。原 manifest 已恢复；原有字段没有改动。

文章、成品素材、迁移用例、清理后的验收证据和兼容性研究分别提交保存，不删除既有工作。

## 后续边界

合并会更新 GitHub 默认分支源码。旧 DSH 用户仍不可从默认分支安装本适配代码；应固定已验证的旧 npm 版本或 Git 提交。发布隔离与安装前兼容检查属于下一阶段工作。

## 远端 CI 状态与限制

插件管理器首次远端 CI 发现普通分支的 `npm publish --dry-run` 会因现有 `0.1.1` 已发布而失败；已将普通分支检查改为 `npm pack --dry-run`，不改实际 Release 工作流。
冻结安装验收仍受 223 个依赖的 24 小时最小发布时间限制（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`，2026-08-31 19:23 CST）；没有降低限制或增加豁免。本次源码合并不表示这项 CI 已通过。

Claude 的 [PR #39](https://github.com/yangbobo2021/relay-dsh-plugin-claude/pull/39) 经必需 `verify` 检查通过后合并，未绕过仓库规则。其余插件快进合并到 `main`。插件管理器修正后的 Node 22、24 检查均通过，冻结安装仍受上述依赖年龄限制。
