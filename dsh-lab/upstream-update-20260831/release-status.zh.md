# 插件发布状态与插件管理器拉取检查

检查日期：2026-08-31，Asia/Shanghai。

> 最终发布进展：用户将版本更正为 `0.1.1` 后，已通过发布 PR #11 和标签工作流发布，提交为 `90db0ac`。npm 发布包 25 个文件与本地验收产物一致，包含推荐插件界面；`latest` 和 `next` 均已指向 `0.1.1`，其中 `next` 通过 npm 官方网页双重验证完成更新。`0.1.0` 保留为历史发布。证据见 `manager-0.1.1-publication.json`。

> 后续发布进展（北京时间 2026-08-31 16:08）：用户授权发布后，插件管理器已经发布正式版 `0.1.0`，包含推荐插件界面；发布提交 `2d0d19d`，npm 的 `latest` 已指向 `0.1.0`。发布包 25 个文件均与本地验收产物一致。`next` 更新遇到 npm EOTP，暂仍为 `0.1.0-rc.4`，等待一次性验证码。证据见 `manager-0.1.0-publication.json`。下文保留发布前的检查快照。

## 结论

**不能说所有修改都已经发布。** 插件管理器的推荐插件界面已经合入 main，但尚未发布；Files / Workbench 的运行代码已经发布，后续 README、许可证和仓库元数据更新尚未进入 npm 包。

本报告中的“8 个插件”沿用上一轮的“包含 Web 前端的 8 个插件”口径。同时检查了 Semantic Router / Monitors，实际覆盖当前全部 10 个插件仓库。

拉取插件管理器后，全部 10 个本地 checkout 的 HEAD 均与各自远端默认分支 HEAD 一致；其他 9 个无需更新源码。

“已经发布”不等于“已经兼容新官方 DSH”。上一轮只进行了兼容性审计，没有实施或发布 DSH `0.1.2-alpha.2` 适配修复。

## npm 发布状态

直接查询 npm registry 的 dist-tags、版本、发布时间、gitHead，并下载对应版本 tarball，校验 SHA-1 后逐文件比较本地文件。缺少 gitHead 的包使用发布内容和 Git 标签差异交叉核对。完整证据见同目录 JSON 文件。

| 插件 | 当前版本 | npm 标签 | 当前修改是否进入发布包 |
| --- | --- | --- | --- |
| Claude | `0.1.5` | latest / next → `0.1.5` | 是；gitHead 与当前提交一致，发布包 19 个文件完全一致 |
| Codex | `0.1.6-rc.1` | next → `0.1.6-rc.1`；latest → `0.1.5` | 是，但新版仅在 next；gitHead 一致，发布包 21 个文件完全一致 |
| Session Import | `0.1.0` | latest / next → `0.1.0` | 是；发布包 16 个文件完全一致 |
| Workbench | `0.1.0` | latest / next → `0.1.0` | 功能代码已发布；后续 README、LICENSE 和 package.json 仓库/许可证元数据未全部发布 |
| Files | `0.1.0` | latest / next → `0.1.0` | 功能代码已发布；后续 README、LICENSE 和 package.json 仓库/许可证元数据未全部发布 |
| Terminal | `0.1.1` | latest → `0.1.1`；next → `0.1.0` | 是；gitHead 一致，发布包 12 个文件完全一致；next 标签仍指向旧版 |
| Events | `0.1.0-internal.2` | internal → `internal.2`；latest → `internal.1` | 是，在 internal；发布包 16 个文件完全一致 |
| Plugin Manager | `0.1.0-rc.4`，源码领先发布提交 | latest / next → `0.1.0-rc.4` | 部分：PR #4–#7 已发布；PR #8 文档和 PR #9 推荐界面尚未发布 |
| Semantic Router（补查） | `0.1.0-internal.2` | internal → `internal.2`；latest → `internal.1` | 是，在 internal；发布包 9 个文件完全一致 |
| Monitors（补查） | `0.1.0-internal.2` | internal → `internal.2`；latest → `internal.1` | 是，在 internal；发布包 9 个文件完全一致 |

表中 internal 标签所指版本的完整前缀均为 `0.1.0-`。上述 internal 包可以从 npm 获取，但仍是内部渠道版本，不代表稳定版承诺。

Files / Workbench 自 `v0.1.0` 后各有 4 个提交，改动限定在 LICENSE、README、package.json 和相应测试，没有产品源码改动。已发布包与本地所有 lib 文件（含 source map）一致。Claude / Codex 中未跟踪的迁移验收材料、Session Import 中未跟踪的本地路径，不计为已发布产品改动。

## 插件管理器：确有他人合并 PR，已拉取

- 来源：`yangbobo2021/relay-dsh-plugin-manager` 的 `origin/main`。
- 拉取前：`169f5d80bab3946e26f1ebe69b81aa74661b3426`，package.json 为 `0.1.0-rc.3`。
- 拉取后：`2115aa26734ec4cf0b6a2fe5c4b65fbff857812e`，package.json 为 `0.1.0-rc.4`。
- 执行 `git fetch origin --prune` 后，确认工作区干净并执行 `git merge --ff-only origin/main`；共前进 8 个提交（含合并提交），35 个文件，+2,689 / -348 行。
- npm `0.1.0-rc.4` 发布于北京时间 2026-08-28 09:33:38，gitHead 为 `a9c1d7178805c9ff7027b15032997dffedcc9084`。
- 检查时没有打开的 PR。

### 已发布的新增功能

- [PR #4](https://github.com/yangbobo2021/relay-dsh-plugin-manager/pull/4)：一次计划/确认安装多个插件，串行操作队列，重启状态反馈。
- [PR #5](https://github.com/yangbobo2021/relay-dsh-plugin-manager/pull/5)：接受受控 DSH 界面确认，校验精确计划答案，不要求重复输入文字确认。
- [PR #6](https://github.com/yangbobo2021/relay-dsh-plugin-manager/pull/6)：GitHub 作者插件发现、精确作者排序及更明确的错误反馈。
- [PR #7](https://github.com/yangbobo2021/relay-dsh-plugin-manager/pull/7)：发布 `0.1.0-rc.4`。

### 尚未发布的修改

- [PR #8](https://github.com/yangbobo2021/relay-dsh-plugin-manager/pull/8)：README 文案更新。
- [PR #9](https://github.com/yangbobo2021/relay-dsh-plugin-manager/pull/9)：由 **Startrekzky（Louis.z）提交并合并**，合并时间为北京时间 **2026-08-30 15:11:18**。
  - “插件市场”改名“推荐插件”，排序 `20 → -10`，成为设置中插件区域的默认页。
  - 新增 Claude / Codex 推荐卡片，包含用途、前置条件、完整安装话术和装好后的检查步骤。
  - 保持 slot id `marketplace` 和 locale 命名空间不变。
  - 移除页面中单独的“先展示计划并等待确认”说明；该 PR 未改动宿主确认逻辑，不能理解为取消安装确认。
  - 更新相应测试和验收脚本，将报告中的固定计数改为从实际渲染内容计算。

PR #9 对应内容仍明确列在 `CHANGELOG.md` 的 `Unreleased` 中。重新构建当前 main 后比较 npm rc.4 tarball：**宿主运行代码一致，`lib/client.js` 不同**，另有 source map 和 6 个文档文件不同，确认推荐界面未进入已发布包。

PR 描述曾提醒 Claude / Codex 缺少 `dsh-plugin` keyword；本次核对当前源码及已发布版本，二者都已包含该 keyword，该提醒已不适用于当前版本。

## 拉取后验证与限制

- 插件管理器 `npm run verify` 成功：typecheck、Vitest 90 通过 / 2 跳过、Node 测试 4 通过、build、临时 profile 安装/config-dump 与打包前端静态渲染验收通过。
- 前端验收结果：`id=marketplace`、`order=-10`、推荐卡片 2 个、安装话术 2 条、管理按钮等控件 0 个。
- 安装验收调用官方 DSH `0a53fb55bea101816fa226bb964ae2bed71c343b`；官方源码状态未改变。
- **这不构成完整新版兼容性通过**：typecheck 仍解析到 Relay 根目录旧 `dsh-llm` / `dsh-client-runtime` / `dsh-user-questions` `0.1.1-rc.2`。拉取后的源码仍引用已被新 DSH 删除的 Runtime。既有兼容性审计中的适配结论不能据此撤销。
- 本次未进行真实模型调用，也未再次运行插件管理器真实浏览器验收。
- 没有提交、推送、创建版本、发布 npm、改动 npm 标签，或重启日常服务。只快进插件管理器 checkout、重建其忽略的 lib 输出，并新增审计记录；未暂存或提交 Relay gitlink，原有未提交内容保留。

## 证据文件

- `release-registry-check.json`：拉取前版本快照、npm 标签、gitHead、发布时间、tarball 校验信息。
- `release-package-comparison.json`：逐文件比较；插件管理器记录为拉取并重新构建后的结果。
- `release-remote-heads.json`：当前 checkout 与各仓库远端默认分支 HEAD 的只读核对。
- `manager-pr9.json`：GitHub 返回的 PR 作者、合并人、时间、提交与文件列表。
