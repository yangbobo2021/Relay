# Plugin Manager Platform Interaction Baseline

Baseline verified: 2026-08-27 16:28 CST (Asia/Shanghai)

Active collection scope, effective 2026-08-30: platform-wide and account-wide
totals for Zhihu, CSDN, Juejin, DEV Community, Medium, Reddit, and GitHub
Discussions. Routine refreshes do not inspect or update individual messages,
comments, articles, answers, posts, or Discussions unless explicitly requested.

The original Plugin Manager single-release baseline and its historical
single-item snapshots are retained below for comparison. They are historical
records, not the active refresh scope. Platform dashboards and account profiles
are authoritative for the active scope. Where no account-wide dashboard exists,
the snapshot records the broadest platform-native aggregate that Chrome exposes
and states the limitation.

## Platform Groups

Published article or full-content platforms:

- Zhihu: Chinese answers and articles.
- CSDN: Chinese technical articles.
- Juejin: Chinese technical articles.
- DEV Community: English articles.
- Medium: English articles.

Published community promotion platforms:

- Reddit: English posts, video posts, reposts, and comment interaction.
- GitHub Discussions: Relay repository announcements and official DSH community
  plugin introductions.

## Data Source Rules

- Logged-in page or creator dashboard data overrides public crawler data.
- Public page data is used only when logged-in data is not available.
- Local publish logs prove publication state and URLs, but not interaction
  metrics unless the page data is included in the log.
- Single-item metrics and account summary metrics are not merged.
- Comment metrics are split into total comments, external comments, owner
  replies, and unique external participants where available.

## Single-Item Baseline

| Platform | Item | URL | Reads / views | Likes / score / reactions | Upvote ratio | Reposts | Total comments / replies / responses | External comments / replies | Owner replies | Unique external participants | Favorites / saves | Data source | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Logged-in embedded page data | One of five latest activity answers; not account-wide |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Logged-in embedded page data | One of five latest activity answers; not account-wide |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Logged-in embedded page data | One of five latest activity answers; not account-wide |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Logged-in embedded page data | One of five latest activity answers; not account-wide |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Logged-in embedded page data | One of five latest activity answers; not account-wide |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 95 | 1 |  |  | 0 | 0 | 0 | 0 | 1 | Logged-in page | Single Plugin Manager article |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 5 |  |  |  |  |  |  |  |  | Public page, 2026-08-27 16:21 CST | Public page exposed reads only |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 | 0 |  |  | 0 | 0 | 0 | 0 |  | Logged-in page | One of four published DEV articles with the same baseline |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` |  |  |  |  | 0 | 0 | 0 | 0 |  | Public page, 2026-08-27 16:21 CST | Public page exposed responses and author follower count, not views/reads/claps |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.2K | 5 | 100% | 1 | 9 | 5 | 4 | 3 |  | Logged-in post insights | External participants: `kantorcodes1`, `No-Weight1118`, `BakingStack` |
| Reddit | Repost to `r/DeepSeekHarness` | Pending exact URL |  | >=1 |  |  | 0 | 0 | 0 | 0 |  | Logged-in Reddit page | Record as an independent item once exact URL is copied |
| GitHub Discussions | Five installable DSH plugins for Codex, Claude Code, Files, and Terminal | `https://github.com/yangbobo2021/Relay/discussions/1` |  |  |  |  | 1 | 0 | 1 | 0 |  | Logged-in / public GitHub Discussion | Reply is an owner supplement with article links; 1 participant |
| GitHub Discussions | Official DSH suite Discussion `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  |  |  |  | 1 | 0 | 1 | 0 |  | Local tracker and public Discussion | Earlier suite announcement; owner Plugin Manager update is not external interaction |
| GitHub Discussions | Show: Manage DSH plugins from Chat with inspectable plans and confirmation | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  |  |  |  | 0 | 0 | 0 | 0 |  | Public GitHub Discussion | 1 participant |

## Account Summary Baseline

| Platform | Account-level metric | Baseline value | Data source | Notes |
| --- | --- | ---: | --- | --- |
| CSDN | Original articles | 5 | Logged-in author page | Account summary, not single-article attribution |
| CSDN | Total visits | 1,019 | Logged-in author page | Account summary, not single-article attribution |
| CSDN | Total likes | 23 | Logged-in author page | Account summary, not single-article attribution |
| CSDN | Total favorites | 20 | Logged-in author page | Account summary, not single-article attribution |
| CSDN | Total comments | 0 | Logged-in author page | Account summary, not single-article attribution |
| CSDN | Followers | 0 | Logged-in author page | Account summary, not single-article attribution |
| Juejin | Articles | 5 | Public author line, 2026-08-27 16:21 CST | Public summary exposed on article page |
| Juejin | Total reads | 44 | Public author line, 2026-08-27 16:21 CST | Public summary exposed on article page |
| Juejin | Followers | 0 | Public author line, 2026-08-27 16:21 CST | Public summary exposed on article page |
| DEV Community | Published articles | 4 | Logged-in page | Each article had fewer than 25 views, 0 reactions, 0 comments |
| DEV Community | Followers | 0 | Logged-in page | Account summary |
| Medium | Followers | 0 | Public article page, 2026-08-27 16:21 CST | Public summary only |
| Medium | Following | 1 | Public article page, 2026-08-27 16:21 CST | Public summary only |
| Zhihu | Account-wide interaction | Not recorded | Logged-in page | The five latest activity answers had 0赞同 and 0评论; older account content already has赞同, so do not treat these five zeros as account-wide zero interaction |

## Reddit Comment Baseline

Main post:

- URL: `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/`
- Views: 2.2K
- Score / upvotes: 5
- Upvote ratio: 100%
- Reposts: 1
- Total comments: 9
- External comments: 5
- Owner replies: 4
- Unique external participants: 3
- External participants: `kantorcodes1`, `No-Weight1118`, `BakingStack`

Visible external-comment themes:

- `kantorcodes1`: plugin install/update/remove command surface could become a
  useful extension point.
- `No-Weight1118`: security warning around npm package trust, version pinning,
  typosquatting, and source review.
- `BakingStack`: participated externally in the thread or repost path.

Repost:

- Surface: `r/DeepSeekHarness`
- Baseline: at least 1 upvote, 0 comments.
- Exact URL: pending.

## GitHub Discussions Baseline

Treat each Discussion as a separate publishing item.

| Discussion | URL | Total replies | External replies | Owner replies | Participants | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` | 1 | 0 | 1 | 1 | Owner reply supplements article links |
| DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` | 1 | 0 | 1 | 1 | Earlier suite announcement; Plugin Manager update is owner-authored |
| DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` | 0 | 0 | 0 | 1 | Plugin Manager-specific official community post |

## Chrome Snapshot - 2026-08-27 19:20 CST

Snapshot verified: 2026-08-27 19:20 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible page only. No
curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / reactions | Upvote ratio | Reposts | Total comments / replies / responses | External comments / replies | Owner replies | Unique external participants | Favorites / saves | Data source | Delta from baseline |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in answer page | +1赞同 |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in answer page | +1赞同 |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 96 | 1 |  |  | 0 | 0 | 0 | 0 | 1 | Chrome logged-in article page | +1 read |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 5 | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome page render state | No change |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 | 0 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in dashboard | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 |  |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in Medium stats | Single-story stats now verified as 0 presentations / 0 views / 0 reads |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.3K | 5 | 100% | 1 | 11 | 7 | 4 | 4 |  | Chrome logged-in post page | +0.1K views, +2 total comments, +2 external comments, +1 external participant |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 211 | 2 | 100% | 1 | 0 | 0 | 0 | 0 |  | Chrome logged-in repost page | Exact URL and views captured; score +1 from `>=1` baseline |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  |  |  |  | 1 | 0 | 1 | 0 |  | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  |  |  |  | 1 | 0 | 1 | 0 |  | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  |  |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in Discussion page | No change |

Account summary values from Chrome at 19:20:

| Platform | Metric | Latest value | Delta from baseline | Data source |
| --- | --- | ---: | --- | --- |
| CSDN | Original articles | 5 | No change | Chrome logged-in author page |
| CSDN | Total visits | 1,022 | +3 | Chrome logged-in author page |
| CSDN | Total likes | 23 | No change | Chrome logged-in author page |
| CSDN | Total favorites | 20 | No change | Chrome logged-in author page |
| CSDN | Total comments | 0 | No change | Chrome logged-in author page |
| CSDN | Followers | 0 | No change | Chrome logged-in author page |
| CSDN | Following | 6 | Newly recorded | Chrome logged-in author page |
| Juejin | Articles | 5 | No change | Chrome page render state |
| Juejin | Total reads | 44 | No change | Chrome page render state |
| Juejin | Followers | 0 | No change | Chrome page render state |
| DEV Community | Published articles | 4 | No change | Chrome logged-in dashboard |
| DEV Community | Total post reactions | 0 | No change | Chrome logged-in dashboard |
| DEV Community | Total post comments | 0 | No change | Chrome logged-in dashboard |
| DEV Community | Total post views | <500 | Newly recorded | Chrome logged-in dashboard |
| DEV Community | Readers this week | 20 | Newly recorded | Chrome logged-in analytics |
| DEV Community | Bookmarks this week | 0 | Newly recorded | Chrome logged-in analytics |
| DEV Community | New followers this week | 0 | Newly recorded | Chrome logged-in analytics |
| DEV Community | Followers | 0 | No change | Chrome logged-in dashboard |
| Medium | August presentations | 17 | Newly recorded | Chrome logged-in Medium stats |
| Medium | August views | 6 | Newly recorded | Chrome logged-in Medium stats |
| Medium | August reads | 1 | Newly recorded | Chrome logged-in Medium stats |
| Medium | Followers | 0 | No change | Chrome logged-in Medium stats |
| Medium | Subscribers | 0 | Newly recorded | Chrome logged-in Medium stats |

Reddit action notes at 19:20:

- Main post now has 11 total comments: 7 external comments, 4 owner replies,
  and 4 unique external participants.
- External participants now include `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- `paramarioh` added a new external comment asking for English, which likely
  needs a reply or a quick check of whether the video or repost appears Chinese
  to English-channel readers.
- `No-Weight1118`'s latest version-scoped review comment is still unreplied in
  the visible Chrome thread.

## Outreach Action Log

- 2026-08-27 21:45 CST: Updated the Reddit `r/DeepSeek` main post body by
  adding the English-captioned demo link at the top.
- 2026-08-27 21:45 CST: Replied to `paramarioh` acknowledging the English
  channel issue and linking the English-captioned demo.
- 2026-08-27 21:51 CST: Added a second reply to `paramarioh` with the native
  English-captioned demo video uploaded to Reddit. This corrects the earlier
  mistaken read of the composer controls; the video upload button was present
  in the rich-text toolbar.
- 2026-08-27 21:54 CST: Replied to `No-Weight1118`'s version-scoped review
  comment, acknowledging that the registry work has not started yet and noting
  that future review evidence should be tied to exact versions/artifacts and
  become stale when new versions land.

## Chrome Snapshot - 2026-08-27 22:02 CST

Snapshot verified: 2026-08-27 22:02 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / reactions | Upvote ratio | Reposts | Total comments / replies / responses | External comments / replies | Owner replies | Unique external participants | Favorites / saves | Data source | Delta from 19:20 snapshot |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 |  |  | 0 | 0 | 0 | 0 | 3 | Chrome logged-in answer page | Favorites now captured as 3; votes/comments unchanged |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 218 | 1 |  |  | 0 | 0 | 0 | 0 | 3 | Chrome logged-in article and author pages | +122 reads, +2 favorites; author page showed 218 reads while article page showed 217 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 5 | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome page render state | Latest Chrome pass did not expose fresh numeric counters; retained prior Chrome render-state value |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 | 0 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in dashboard | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 |  |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in Medium stats | No change; 0 presentations / 0 views / 0 reads |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.5K | 5 | 100% | 1 | 14 | 7 | 7 | 4 |  | Chrome logged-in post page | +0.2K views, +3 total comments, +3 owner replies; external comments unchanged |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 244 | 2 | 100% | 1 | 0 | 0 | 0 | 0 |  | Chrome logged-in repost page | +33 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | 0 |  |  | 1 | 0 | 1 | 0 |  | Chrome logged-in Discussion page | No comment change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | 0 |  |  | 1 | 0 | 1 | 0 |  | Chrome logged-in Discussion page | No comment change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | 1 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in Discussion page | Visible pre-replies counter is 1; replies remain 0 |

Account summary values from Chrome at 22:02:

| Platform | Metric | Latest value | Delta from 19:20 snapshot | Data source |
| --- | --- | ---: | --- | --- |
| CSDN | Original articles | 5 | No change | Chrome logged-in author page |
| CSDN | Total visits | 1,144 | +122 | Chrome logged-in author page |
| CSDN | Total likes | 23 | No change | Chrome logged-in author page |
| CSDN | Total favorites | 22 | +2 | Chrome logged-in author page |
| CSDN | Total comments | 0 | No change | Chrome logged-in author page |
| CSDN | Followers | 0 | No change | Chrome logged-in author page |
| CSDN | Following | 6 | No change | Chrome logged-in author page |
| Juejin | Articles | 5 | No change captured | Chrome page render state |
| Juejin | Total reads | 44 | No change captured | Chrome page render state |
| Juejin | Followers | 0 | No change captured | Chrome page render state |
| DEV Community | Published articles | 4 | No change | Chrome logged-in dashboard |
| DEV Community | Total post reactions | 0 | No change | Chrome logged-in dashboard |
| DEV Community | Total post comments | 0 | No change | Chrome logged-in dashboard |
| DEV Community | Total post views | <500 | No change | Chrome logged-in dashboard |
| DEV Community | Readers this week | 20 | No change | Chrome logged-in analytics |
| DEV Community | Bookmarks this week | 0 | No change | Chrome logged-in analytics |
| DEV Community | New followers this week | 0 | No change | Chrome logged-in analytics |
| DEV Community | Followers | 0 | No change | Chrome logged-in dashboard |
| Medium | August presentations | 17 | No change | Chrome logged-in Medium stats |
| Medium | August views | 6 | No change | Chrome logged-in Medium stats |
| Medium | August reads | 1 | No change | Chrome logged-in Medium stats |
| Medium | Followers | 0 | No change | Chrome logged-in Medium stats |
| Medium | Subscribers | 0 | No change | Chrome logged-in Medium stats |

Reddit action notes at 22:02:

- Main post now has 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- The visible Chrome thread shows replies to both `paramarioh`'s English
  content question and `No-Weight1118`'s version-scoped review note.
- No new unreplied external Reddit comment was visible in the latest Chrome
  pass.

## Chrome Snapshot - 2026-08-28 06:51 CST

Snapshot verified: 2026-08-28 06:51 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / reactions | Upvote ratio | Reposts | Total comments / replies / responses | External comments / replies | Owner replies | Unique external participants | Favorites / saves | Data source | Delta from 2026-08-27 22:02 snapshot |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 |  |  | 0 | 0 | 0 | 0 | 3 | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 225 | 5 |  |  | 0 | 0 | 0 | 0 | 4 | Chrome logged-in article and author pages | +7 reads, +4 likes, +1 favorite; author page showed 225 reads while article page showed 224 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 5 | 0 |  |  | 0 | 0 | 0 | 0 | 0 | Chrome page render state | Latest Chrome pass did not expose fresh numeric counters; retained prior Chrome render-state value |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 | 0 |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in dashboard | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 |  |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in Medium stats | No single-story change; 0 presentations / 0 views / 0 reads |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.8K | 7 | 100% | 1 | 14 | 7 | 7 | 4 |  | Chrome logged-in post page | +0.3K views, +2 score; comment split unchanged |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 318 | 2 | 100% | 1 | 0 | 0 | 0 | 0 |  | Chrome logged-in repost page | +74 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  |  |  |  | 1 | 0 | 1 | 0 |  | Chrome logged-in Discussion page | No comment change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  |  |  |  | 1 | 0 | 1 | 0 |  | Chrome logged-in Discussion page | No comment change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  |  |  |  | 0 | 0 | 0 | 0 |  | Chrome logged-in Discussion page | Replies remain 0; visible non-comment counters are not merged into comment metrics |

Account summary values from Chrome at 06:51:

| Platform | Metric | Latest value | Delta from 2026-08-27 22:02 snapshot | Data source |
| --- | --- | ---: | --- | --- |
| CSDN | Original articles | 5 | No change | Chrome logged-in author page |
| CSDN | Total visits | 1,155 | +11 | Chrome logged-in author page |
| CSDN | Total likes | 27 | +4 | Chrome logged-in author page |
| CSDN | Total favorites | 23 | +1 | Chrome logged-in author page |
| CSDN | Total comments | 0 | No change | Chrome logged-in author page |
| CSDN | Followers | 0 | No change | Chrome logged-in author page |
| CSDN | Following | 6 | No change | Chrome logged-in author page |
| Juejin | Articles | 5 | No change captured | Chrome page render state |
| Juejin | Total reads | 44 | No change captured | Chrome page render state |
| Juejin | Followers | 0 | No change captured | Chrome page render state |
| DEV Community | Published articles | 4 | No change | Chrome logged-in dashboard |
| DEV Community | Total post reactions | 0 | No change | Chrome logged-in dashboard |
| DEV Community | Total post comments | 0 | No change | Chrome logged-in dashboard |
| DEV Community | Total post views | <500 | No change | Chrome logged-in dashboard |
| DEV Community | Readers this week | 20 | No change | Chrome logged-in analytics |
| DEV Community | Bookmarks this week | 0 | No change | Chrome logged-in analytics |
| DEV Community | New followers this week | 0 | No change | Chrome logged-in analytics |
| DEV Community | Followers | 0 | No change | Chrome logged-in dashboard |
| Medium | August presentations | 19 | +2 | Chrome logged-in Medium stats |
| Medium | August views | 6 | No change | Chrome logged-in Medium stats |
| Medium | August reads | 1 | No change | Chrome logged-in Medium stats |
| Medium | Followers | 0 | No change | Chrome logged-in Medium stats |
| Medium | Subscribers | 0 | No change | Chrome logged-in Medium stats |

Reddit action notes at 06:51:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- The visible Chrome thread still shows replies to both `paramarioh`'s English
  content question and `No-Weight1118`'s version-scoped review note.
- No new unreplied external Reddit comment was visible in the latest Chrome
  pass.

## Chrome Snapshot - 2026-08-28 08:37 CST

Snapshot verified: 2026-08-28 08:37 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

Interaction scope for this snapshot includes reads/views, likes/upvotes,
reactions, comments/replies, favorites/bookmarks, shares/reposts, awards, and
account/follower events when the platform exposes them. A visible action button
without a numeric counter is recorded as unavailable, not as zero.

| Platform | Item | URL | Reads / views | Likes / score / upvotes | Upvote ratio | Total comments / replies | External comments / replies | Owner replies | Unique external participants | Favorites / bookmarks | Shares / reposts | Other interactions | Data source | Delta from 06:51 snapshot |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 3 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 226 | 5 likes |  | 0 | 0 | 0 | 0 | 4 | Share count unavailable |  | Chrome logged-in article and author pages | +1 read; article page showed 225 while author page showed 226 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 22 | 0 likes |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in article page | +17 views; like/comment/favorite controls show no numeric count |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 views; 0 readers this week | 0 reactions |  | 0 | 0 | 0 | 0 | 0 bookmarks this week | Share count unavailable | 0 reacting users | Chrome logged-in post manage and detailed stats pages | No interaction change; detailed single-post metrics now captured |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 presentations / 0 views / 0 reads | Clap count unavailable |  | 0 visible responses | 0 | 0 | 0 | Bookmark count unavailable | Share count unavailable |  | Chrome logged-in Medium stats and story pages | No single-story change |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.8K | 7 score | 100% | 14 | 7 | 7 | 4 |  | 1 repost | 0 awards | Chrome logged-in post page | No change |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 326 | 2 score | 100% | 0 | 0 | 0 | 0 |  | 1 repost |  | Chrome logged-in repost page | +8 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | Upvote/reaction split newly captured; reply count unchanged |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | Upvote/reaction split newly captured; reply count unchanged |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | Main post: 1 owner upvote, 0 external upvotes |  | 0 | 0 | 0 | 0 |  |  | 0 emoji reactions | Chrome logged-in Discussion page | Upvote/reaction split newly captured; reply count unchanged |

Account and period summaries from Chrome at 08:37:

| Platform | Scope / period | Published content | Reads / views | Likes / approvals / reactions | Comments | Favorites / bookmarks | Shares | Reposts | Followers / account events | Data source |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| Zhihu | Account cumulative | 37 published items | 1.2w reads | 30 approvals; 0 likes | 10 | 32 | 3 | 0 | 10 followers; 4 following; profile viewed 368 times | Chrome logged-in creator data center and profile; data center updated 2026-08-28 07:55:48 |
| Zhihu | Last 7 days | 18 published items | 1,430 reads | 15 approvals; 0 likes | 1 | 9 | 0 | 0 | 0 net/new/unfollow events; 5 profile visitors; 0.00% conversion | Chrome logged-in creator data center |
| Zhihu | Today | 2 published items | 122 reads | 1 approval; 0 likes | 0 | 1 | 0 | 0 | 3 profile visitors; 0 follower events | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,156 total visits | 27 likes | 0 | 23 | Unavailable | Unavailable | 0 followers; 6 following | Chrome logged-in author page |
| Juejin | Account cumulative | 5 articles | 70 total reads | Not exposed account-wide | Not exposed account-wide | Not exposed account-wide | Unavailable | Unavailable | 0 followers | Chrome logged-in article page |
| DEV Community | Account dashboard | 4 posts | <500 total post views | 0 total post reactions | 0 total post comments | 0 this week | Unavailable | Unavailable | 0 followers | Chrome logged-in dashboard |
| DEV Community | Last 7 days |  | 20 readers | 0 reactions from 0 unique users | 0 | 0 | Unavailable | Unavailable | 0 new followers; Direct / Unknown supplied all 20 views | Chrome logged-in analytics |
| Medium | August 2026 | 2 listed stories | 19 presentations / 6 views / 1 read | Clap total unavailable | Response total unavailable | Bookmark total unavailable | Unavailable | Unavailable | 0 followers; 0 subscribers | Chrome logged-in Medium stats |

Reddit action notes at 08:37:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- Replies to `paramarioh` and `No-Weight1118` remain visible. No new
  unreplied external Reddit comment was visible.

Interpretation notes:

- Zhihu account totals are account-wide and include non-Relay/DSH content.
  The five listed Relay/DSH answers remain a narrower item-level scope.
- GitHub upvotes shown above are the author's own upvotes. There are no
  externally attributable upvotes or emoji reactions on the three tracked
  Discussions in this Chrome pass.
- DEV does not expose a numeric share count. The Plugin Manager post has zero
  reactions, comments, bookmarks, and weekly readers, while the account has 20
  readers across all four posts for the current week.

## Chrome Snapshot - 2026-08-28 11:04 CST

Snapshot verified: 2026-08-28 11:04 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / upvotes | Upvote ratio | Total comments / replies | External comments / replies | Owner replies | Unique external participants | Favorites / bookmarks | Shares / reposts | Other interactions | Data source | Delta from 08:37 snapshot |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 3 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 227 | 5 likes |  | 0 | 0 | 0 | 0 | 4 | Share count unavailable |  | Chrome logged-in article and author pages | +1 read |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 24 | 0 likes |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in article page | +2 views |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 views; 0 readers this week | 0 reactions |  | 0 | 0 | 0 | 0 | 0 bookmarks this week | Share count unavailable | 0 reacting users | Chrome logged-in dashboard and detailed stats | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 presentations / 0 views / 0 reads | Clap count unavailable |  | 0 visible responses | 0 | 0 | 0 | Bookmark count unavailable | Share count unavailable |  | Chrome logged-in Medium stats | No change |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.9K | 7 score | 100% | 14 | 7 | 7 | 4 |  | 1 repost | 0 awards | Chrome logged-in post page | +0.1K views; other interactions unchanged |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 340 | 2 score | 100% | 0 | 0 | 0 | 0 |  | 1 repost |  | Chrome logged-in repost page | +14 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | Main post: 1 owner upvote, 0 external upvotes |  | 0 | 0 | 0 | 0 |  |  | 0 emoji reactions | Chrome logged-in Discussion page | No change |

Account and period summaries from Chrome at 11:04:

| Platform | Scope / period | Published content | Reads / views | Likes / approvals / reactions | Comments | Favorites / bookmarks | Shares | Reposts | Followers / account events | Delta from 08:37 snapshot | Data source |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Zhihu | Creator data center cumulative | 37 published items | 1.3w reads | 32 approvals; 0 likes | 10 | 34 | 3 | 0 | 10 followers; 4 following; profile viewed 370 times | Reads bucket +0.1w; +2 approvals; +2 favorites; +2 profile views | Chrome logged-in creator data center and profile; data center updated 2026-08-28 11:00:17 |
| Zhihu | Last 7 days | 18 published items | 1,528 reads | 17 approvals; 0 likes | 1 | 11 | 0 | 0 | 0 net/new/unfollow events; 5 profile visitors; 0.00% conversion | +98 reads; +2 approvals; +2 favorites | Chrome logged-in creator data center |
| Zhihu | Today | 2 published items | 220 reads | 3 approvals; 0 likes | 0 | 3 | 0 | 0 | 3 profile visitors; 0 follower events | +98 reads; +2 approvals; +2 favorites | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,159 total visits | 27 likes | 0 | 23 | Unavailable | Unavailable | 0 followers; 6 following | +3 total visits | Chrome logged-in author page |
| Juejin | Account cumulative | 5 articles | 72 total reads | Not exposed account-wide | Not exposed account-wide | Not exposed account-wide | Unavailable | Unavailable | 0 followers | +2 total reads | Chrome logged-in article page |
| DEV Community | Account dashboard | 4 posts | <500 total post views | 0 total post reactions | 0 total post comments | 0 this week | Unavailable | Unavailable | 0 followers | No change | Chrome logged-in dashboard |
| DEV Community | Last 7 days |  | 20 readers | 0 reactions from 0 unique users | 0 | 0 | Unavailable | Unavailable | 0 new followers; Direct / Unknown supplied all 20 views | No change | Chrome logged-in analytics |
| Medium | August 2026 | 2 listed stories | 19 presentations / 6 views / 1 read | Clap total unavailable | Response total unavailable | Bookmark total unavailable | Unavailable | Unavailable | 0 followers; 0 subscribers | No change | Chrome logged-in Medium stats |

Zhihu counter note at 11:04:

- The creator data center is used as the comparable account baseline because it
  labels both the time range and update time. Its cumulative values are 32
  approvals, 0 likes, 10 comments, and 34 favorites.
- The profile achievement panel separately shows 33 approvals, 5 likes, and 35
  favorites. These counters use a different or lagged platform aggregation and
  are retained as a secondary display, not merged into the data-center totals.

Reddit action notes at 11:04:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- No new unreplied external Reddit comment was visible.

## Chrome Snapshot - 2026-08-28 14:30 CST

Snapshot verified: 2026-08-28 14:30 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / upvotes | Upvote ratio | Total comments / replies | External comments / replies | Owner replies | Unique external participants | Favorites / bookmarks | Shares / reposts | Other interactions | Data source | Delta from 11:04 snapshot |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 3 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 232 | 5 likes |  | 0 | 0 | 0 | 0 | 4 | Share count unavailable |  | Chrome logged-in article and author pages | +5 reads; article page showed 231 while author page showed 232 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 24 | 0 likes |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in article page | No item-level change |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 views; 0 readers this week | 0 reactions |  | 0 | 0 | 0 | 0 | 0 bookmarks this week | Share count unavailable | 0 reacting users | Chrome logged-in dashboard and detailed stats | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 presentations / 0 views / 0 reads | Clap count unavailable |  | 0 visible responses | 0 | 0 | 0 | Bookmark count unavailable | Share count unavailable |  | Chrome logged-in Medium stats | No change |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 3K | 7 score | 100% | 14 | 7 | 7 | 4 |  | 1 repost | 0 awards | Chrome logged-in post page | +0.1K views; other interactions unchanged |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 365 | 2 score | 100% | 0 | 0 | 0 | 0 |  | 1 repost |  | Chrome logged-in repost page | +25 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | Main post: 1 owner upvote, 0 external upvotes |  | 0 | 0 | 0 | 0 |  |  | 0 emoji reactions | Chrome logged-in Discussion page | No change |

Account and period summaries from Chrome at 14:30:

| Platform | Scope / period | Published content | Reads / views | Likes / approvals / reactions | Comments | Favorites / bookmarks | Shares | Reposts | Followers / account events | Delta from 11:04 snapshot | Data source |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Zhihu | Creator data center cumulative | 38 published items | 1.3w reads | 32 approvals; 0 likes | 10 | 35 | 3 | 0 | 10 followers; 4 following; profile viewed 372 times | +1 published item; +1 favorite; +2 profile views | Chrome logged-in creator data center and profile; data center updated 2026-08-28 13:55:48 |
| Zhihu | Last 7 days | 19 published items | 1,623 reads | 17 approvals; 0 likes | 1 | 12 | 0 | 0 | 0 net/new/unfollow events; 5 profile visitors; 0.00% conversion | +1 published item; +95 reads; +1 favorite | Chrome logged-in creator data center |
| Zhihu | Today | 3 published items | 315 reads | 3 approvals; 0 likes | 0 | 4 | 0 | 0 | 3 profile visitors; 0 follower events | +1 published item; +95 reads; +1 favorite | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,167 total visits | 27 likes | 0 | 23 | Unavailable | Unavailable | 0 followers; 6 following | +8 total visits | Chrome logged-in author page |
| Juejin | Account cumulative | 5 articles | 75 total reads | Not exposed account-wide | Not exposed account-wide | Not exposed account-wide | Unavailable | Unavailable | 0 followers | +3 total reads | Chrome logged-in article page |
| DEV Community | Account dashboard | 4 posts | <500 total post views | 0 total post reactions | 0 total post comments | 0 this week | Unavailable | Unavailable | 0 followers | No change | Chrome logged-in dashboard |
| DEV Community | Last 7 days |  | 20 readers | 0 reactions from 0 unique users | 0 | 0 | Unavailable | Unavailable | 0 new followers; Direct / Unknown supplied all 20 views | No change | Chrome logged-in analytics |
| Medium | August 2026 | 2 listed stories | 19 presentations / 6 views / 1 read | Clap total unavailable | Response total unavailable | Bookmark total unavailable | Unavailable | Unavailable | 0 followers; 0 subscribers | No change | Chrome logged-in Medium stats |

Zhihu scope and counter notes at 14:30:

- One new non-tracked answer was published at 11:44, increasing the account
  scope from 37 to 38 published items. The five tracked Relay/DSH answers did
  not change.
- The creator data center cumulative baseline is 32 approvals, 0 likes, 10
  comments, and 35 favorites. The profile achievement panel separately shows
  34 approvals, 5 likes, and 36 favorites; these counters remain separate.

Reddit action notes at 14:30:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- No new unreplied external Reddit comment was visible.

## Chrome Snapshot - 2026-08-28 15:30 CST

Snapshot verified: 2026-08-28 15:30 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / upvotes | Upvote ratio | Total comments / replies | External comments / replies | Owner replies | Unique external participants | Favorites / bookmarks | Shares / reposts | Other interactions | Data source | Delta from 14:30 snapshot |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 3 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 233 | 5 likes |  | 0 | 0 | 0 | 0 | 4 | Share count unavailable |  | Chrome logged-in article and author pages | +1 read; article page showed 232 while author page showed 233 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 26 | 0 likes |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in article page | +2 reads |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 views; 0 readers this week | 0 reactions |  | 0 | 0 | 0 | 0 | 0 bookmarks this week | Share count unavailable | 0 reacting users | Chrome logged-in dashboard and detailed stats | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 presentations / 0 views / 0 reads | Clap count unavailable |  | 0 visible responses | 0 | 0 | 0 | Bookmark count unavailable | Share count unavailable |  | Chrome logged-in Medium stats | No change |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 3K | 7 score | 100% | 14 | 7 | 7 | 4 |  | 1 repost | 0 awards | Chrome logged-in post page | No change |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 368 | 2 score | 100% | 0 | 0 | 0 | 0 |  | 1 repost |  | Chrome logged-in repost page | +3 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | Main post: 1 owner upvote, 0 external upvotes |  | 0 | 0 | 0 | 0 |  |  | 0 emoji reactions | Chrome logged-in Discussion page | No change |

Account and period summaries from Chrome at 15:30:

| Platform | Scope / period | Published content | Reads / views | Likes / approvals / reactions | Comments | Favorites / bookmarks | Shares | Reposts | Followers / account events | Delta from 14:30 snapshot | Data source |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Zhihu | Creator data center cumulative | 38 published items | 1.3w reads | 32 approvals; 0 likes | 10 | 35 | 3 | 0 | 10 followers; 4 following; profile-view total not exposed in this render | Published and interaction totals unchanged | Chrome logged-in creator data center and profile; data center updated 2026-08-28 15:02:18 |
| Zhihu | Last 7 days | 19 published items | 1,643 reads | 17 approvals; 0 likes | 1 | 12 | 0 | 0 | 0 net/new/unfollow events; 5 profile visitors; 0.00% conversion | +20 reads; other metrics unchanged | Chrome logged-in creator data center |
| Zhihu | Today | 3 published items | 335 reads | 3 approvals; 0 likes | 0 | 4 | 0 | 0 | 3 profile visitors; 0 follower events | +20 reads; other metrics unchanged | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,168 total visits | 27 likes | 0 | 23 | Unavailable | Unavailable | 0 followers; 6 following | +1 total visit | Chrome logged-in author page |
| Juejin | Account cumulative | 5 articles | 77 total reads | Not exposed account-wide | Not exposed account-wide | Not exposed account-wide | Unavailable | Unavailable | 0 followers | +2 total reads | Chrome logged-in article page |
| DEV Community | Account dashboard | 4 posts | <500 total post views | 0 total post reactions | 0 total post comments | 0 this week | Unavailable | Unavailable | 0 followers | No change | Chrome logged-in dashboard |
| DEV Community | Last 7 days |  | 20 readers | 0 reactions from 0 unique users | 0 | 0 | Unavailable | Unavailable | 0 new followers; Direct / Unknown supplied all 20 views | No change | Chrome logged-in analytics |
| Medium | August 2026 | 2 listed stories | 19 presentations / 6 views / 1 read | Clap total unavailable | Response total unavailable | Bookmark total unavailable | Unavailable | Unavailable | 0 followers; 0 subscribers | No change | Chrome logged-in Medium stats |

Zhihu scope and counter notes at 15:30:

- The five tracked Relay/DSH answers did not change: two approvals and three
  favorites in total, with no comments.
- The creator data center cumulative baseline remains 32 approvals, 0 likes,
  10 comments, and 35 favorites. The profile achievement panel separately
  shows 34 approvals, 5 likes, and 36 favorites; these counters remain
  separate.
- The creator data center reported 1,643 reads for the last 7 days, while the
  creator home card rendered 1,642 during this collection. This snapshot uses
  the dedicated data-center value.

Reddit action notes at 15:30:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- No new unreplied external Reddit comment was visible.

## Chrome Snapshot - 2026-08-29 06:55 CST

Snapshot verified: 2026-08-29 06:55 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / upvotes | Upvote ratio | Total comments / replies | External comments / replies | Owner replies | Unique external participants | Favorites / bookmarks | Shares / reposts | Other interactions | Data source | Delta from 2026-08-28 15:30 snapshot |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 3 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 234 | 6 likes |  | 0 | 0 | 0 | 0 | 4 | Share count unavailable |  | Chrome logged-in article and author pages | +1 read and +1 like; article page showed 233 while author page showed 234 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 30 | 0 likes |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in article page | +4 reads |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 views; 0 readers this week | 0 reactions |  | 0 | 0 | 0 | 0 | 0 bookmarks this week | Share count unavailable | 0 reacting users | Chrome logged-in dashboard and detailed stats | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 0 presentations / 0 views / 0 reads | Clap count unavailable |  | 0 visible responses | 0 | 0 | 0 | Bookmark count unavailable | Share count unavailable |  | Chrome logged-in Medium stats | No change |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 3.4K | 7 score | 100% | 14 | 7 | 7 | 4 |  | 1 repost | No award count visible | Chrome logged-in post page | +0.4K views; other interactions unchanged |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 496 | 3 score | 100% | 0 | 0 | 0 | 0 |  | 1 repost |  | Chrome logged-in repost page | +128 views and +1 score |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | Main post: 1 owner upvote, 0 external upvotes |  | 0 | 0 | 0 | 0 |  |  | 0 emoji reactions | Chrome logged-in Discussion page | No change |

Account and period summaries from Chrome at 06:55:

| Platform | Scope / period | Published content | Reads / views | Likes / approvals / reactions | Comments | Favorites / bookmarks | Shares | Reposts | Followers / account events | Delta from 2026-08-28 15:30 snapshot | Data source |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Zhihu | Creator data center cumulative | 49 published items | 1.3w reads | 39 approvals; 1 like | 10 | 39 | 6 | 0 | 10 followers; 4 following; profile viewed 376 times | +11 published items; +7 approvals; +1 like; +4 favorites; +3 shares; followers unchanged | Chrome logged-in creator data center and profile; data center updated 2026-08-29 05:57:49 |
| Zhihu | Last 7 days | 30 published items | 2,305 reads | 25 approvals; 1 like | 1 | 16 | 3 | 0 | 0 net/new/unfollow events; 11 profile visitors; 0.00% conversion | +11 published items; +662 reads; +8 approvals; +1 like; +4 favorites; +3 shares; +6 profile visitors | Chrome logged-in creator data center |
| Zhihu | Today, August 29 | 0 published items | 106 reads | 0 approvals; 0 likes | 0 | 0 | 0 | 0 | 6 profile visitors; 0 follower events | New calendar-day counter; not directly comparable with August 28 today values | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,172 total visits | 28 likes | 0 | 23 | Unavailable | Unavailable | 0 followers; 6 following | +4 total visits and +1 like | Chrome logged-in author page |
| Juejin | Account cumulative | 6 articles | 97 total reads | Not exposed account-wide | Not exposed account-wide | Not exposed account-wide | Unavailable | Unavailable | 0 followers | +1 article and +20 total reads | Chrome logged-in article page |
| DEV Community | Account dashboard | 4 posts | <500 total post views | 0 total post reactions | 0 total post comments | 0 this week | Unavailable | Unavailable | 0 followers | No change | Chrome logged-in dashboard |
| DEV Community | Last 7 days |  | 40 readers | 0 reactions from 0 unique users | 0 | 0 | Unavailable | Unavailable | 0 new followers; Direct / Unknown supplied all 40 views | +20 readers; other metrics unchanged | Chrome logged-in analytics |
| Medium | August 2026 | 2 listed stories | 19 presentations / 6 views / 1 read | Clap total unavailable | Response total unavailable | Bookmark total unavailable | Unavailable | Unavailable | 0 followers; 0 subscribers | No change | Chrome logged-in Medium stats |

Zhihu scope and counter notes at 06:55:

- The five tracked Relay/DSH answers remain unchanged: two approvals and three
  favorites in total, with no comments.
- Account growth came from content outside those five tracked answers. The
  profile now shows 36 answers, 10 articles, 3 ideas, and 6 questions, compared
  with 27 answers, 9 articles, 2 ideas, and 5 questions at the prior snapshot.
  The creator data center counts answers, articles, ideas, and videos as
  published content, so its cumulative total increased by 11 rather than 12.
- The creator data center cumulative counters are 39 approvals, 1 like, 10
  comments, 39 favorites, and 6 shares. The profile achievement panel
  separately shows 42 approvals, 6 likes, and 40 favorites; these counters
  remain separate.

Reddit action notes at 06:55:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- No new unreplied external Reddit comment was visible.

## Chrome Snapshot - 2026-08-29 11:46 CST

Snapshot verified: 2026-08-29 11:46 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in or Chrome visible/render state
only. No curl, public API, or search-engine data is used.

| Platform | Item | URL | Reads / views | Likes / score / upvotes | Upvote ratio | Total comments / replies | External comments / replies | Owner replies | Unique external participants | Favorites / bookmarks | Shares / reposts | Other interactions | Data source | Delta from 06:55 snapshot |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| Zhihu | DeepSeek Harness 有什么好用的插件？ | `https://www.zhihu.com/question/2071617281214378127/answer/2076332198798563255` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 3 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 普通人用 DeepSeek Harness 都能干些什么？ | `https://www.zhihu.com/question/2071616098441455091/answer/2076332670578176572` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 怎么看 DeepSeek Harness 正式开源，采用一切皆插件的架构？ | `https://www.zhihu.com/question/2071348486667237276/answer/2076332845115642934` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 如何看待 DeepSeek 组建 Harness 团队对标 Claude Code？ | `https://www.zhihu.com/question/2040450519303288568/answer/2076332988095272623` |  | 0 approvals |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| Zhihu | 完全没有编程基础的人能上手 DeepSeek Harness 吗？ | `https://www.zhihu.com/question/2071518584656995815/answer/2076333171440882033` |  | 1 approval |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in answer page | No change |
| CSDN | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://blog.csdn.net/nethider/article/details/164098601` | 236 | 6 likes |  | 0 | 0 | 0 | 0 | 4 | Share count unavailable |  | Chrome logged-in article and author pages | +2 reads; article page showed 235 while author page showed 236 |
| Juejin | 我给 DeepSeek Harness 做了一个能在对话里安装插件的插件 | `https://juejin.cn/post/7678220784615391284` | 30 | 0 likes |  | 0 | 0 | 0 | 0 | 0 | Share count unavailable |  | Chrome logged-in article page | No change |
| DEV Community | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 views; 0 readers this week | 0 reactions |  | 0 | 0 | 0 | 0 | 0 bookmarks this week | Share count unavailable | 0 reacting users | Chrome logged-in dashboard and detailed stats | No change |
| Medium | I Built a DeepSeek Harness Plugin That Installs Other Plugins from Chat | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` | 1 presentation / 0 views / 0 reads | Clap count unavailable |  | 0 visible responses | 0 | 0 | 0 | Bookmark count unavailable | Share count unavailable |  | Chrome logged-in Medium stats | +1 presentation |
| Reddit | I made a DSH plugin that finds and installs other plugins from chat | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 3.5K | 7 score | 100% | 14 | 7 | 7 | 4 |  | 1 repost | No award count visible | Chrome logged-in post page | +0.1K views; other interactions unchanged |
| Reddit | Repost to `r/DeepSeekHarness` | `https://www.reddit.com/r/DeepSeekHarness/comments/1vzd0wl/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 527 | 3 score | 100% | 0 | 0 | 0 | 0 |  | 1 repost |  | Chrome logged-in repost page | +31 views |
| GitHub Discussions | Relay `#1` | `https://github.com/yangbobo2021/Relay/discussions/1` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4561` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  | Main post: 1 owner upvote, 0 external upvotes |  | 1 | 0 | 1 | 0 |  |  | Main post: 0 emoji reactions; owner reply: 1 owner upvote, 0 external upvotes/reactions | Chrome logged-in Discussion page | No change |
| GitHub Discussions | DSH official `#4660` | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  | Main post: 1 owner upvote, 0 external upvotes |  | 0 | 0 | 0 | 0 |  |  | 0 emoji reactions | Chrome logged-in Discussion page | No change |

Account and period summaries from Chrome at 11:46:

| Platform | Scope / period | Published content | Reads / views | Likes / approvals / reactions | Comments | Favorites / bookmarks | Shares | Reposts | Followers / account events | Delta from 06:55 snapshot | Data source |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Zhihu | Creator data center cumulative | 50 published items | 1.3w reads | 43 approvals; 1 like | 10 | 41 | 6 | 0 | 10 followers; 4 following; profile viewed 378 times | +1 published item; +4 approvals; +2 favorites; +2 profile views | Chrome logged-in creator data center and profile; data center updated 2026-08-29 10:58:19 |
| Zhihu | Last 7 days | 31 published items | 2,411 reads | 29 approvals; 1 like | 1 | 18 | 3 | 0 | 0 net/new/unfollow events; 11 profile visitors; 0.00% conversion | +1 published item; +106 reads; +4 approvals; +2 favorites | Chrome logged-in creator data center |
| Zhihu | Today, August 29 | 1 published item | 212 reads | 4 approvals; 0 likes | 0 | 2 | 0 | 0 | 6 profile visitors; 0 follower events | +1 published item; +106 reads; +4 approvals; +2 favorites | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,176 total visits | 28 likes | 0 | 23 | Unavailable | Unavailable | 0 followers; 6 following | +4 total visits | Chrome logged-in author page |
| Juejin | Account cumulative | 6 articles | 103 total reads | Not exposed account-wide | Not exposed account-wide | Not exposed account-wide | Unavailable | Unavailable | 0 followers | +6 total reads | Chrome logged-in article page |
| DEV Community | Account dashboard | 4 posts | <500 total post views | 0 total post reactions | 0 total post comments | 0 this week | Unavailable | Unavailable | 0 followers | No change | Chrome logged-in dashboard |
| DEV Community | Last 7 days |  | 40 readers | 0 reactions from 0 unique users | 0 | 0 | Unavailable | Unavailable | 0 new followers; Direct / Unknown supplied all 40 views | No change | Chrome logged-in analytics |
| Medium | August 2026 | 2 listed stories | 20 presentations / 6 views / 1 read | Clap total unavailable | Response total unavailable | Bookmark total unavailable | Unavailable | Unavailable | 0 followers; 0 subscribers | +1 presentation, attributed to the Plugin Manager story | Chrome logged-in Medium stats |

Zhihu scope and counter notes at 11:46:

- The five tracked Relay/DSH answers remain unchanged: two approvals and three
  favorites in total, with no comments.
- The account added one answer outside the tracked set. The profile now shows
  37 answers, 10 articles, 3 ideas, and 6 questions.
- The creator data center cumulative counters are 43 approvals, 1 like, 10
  comments, 41 favorites, and 6 shares. The profile achievement panel
  separately shows 45 approvals, 6 likes, and 43 favorites; these counters
  remain separate.

Reddit action notes at 11:46:

- Main post remains at 14 total comments: 7 external comments, 7 owner replies,
  and 4 unique external participants.
- External participants remain `kantorcodes1`, `No-Weight1118`,
  `BakingStack`, and `paramarioh`.
- No new unreplied external Reddit comment was visible.

## Platform-Wide Chrome Snapshot - 2026-08-30 07:32 CST

Snapshot verified: 2026-08-30 07:32 CST (Asia/Shanghai)

Source rule for this snapshot: Chrome logged-in creator dashboards, account
profiles, or platform-native account search only. No individual message or
single-content interaction was collected. No curl, public API, or search-engine
data is used.

| Platform | Account scope | Published content / activity | Account-wide reach | Account-wide interactions | Audience / profile | Delta from 2026-08-29 11:46 account summary | Data source and limits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Zhihu | Cumulative creator data | 50 published items; profile: 37 answers, 10 articles, 3 ideas, 6 questions | 1.4w reads | 43 approvals; 1 like; 10 comments; 46 favorites; 8 shares; 0 reposts | 10 followers; 4 following; profile viewed 380 times | Read bucket rose from 1.3w to 1.4w; +5 favorites; +2 shares; +2 profile views | Chrome logged-in creator data center and profile; data center updated 2026-08-30 06:56:54 |
| Zhihu | Last 7 days | 31 published items | 2,574 reads; 0 plays | 29 approvals; 1 like; 1 comment; 23 favorites; 5 shares; 0 reposts | 15 profile visitors; 0 net/new/unfollow events; 0.00% conversion | +163 reads; +5 favorites; +2 shares; +4 profile visitors | Chrome logged-in creator data center |
| Zhihu | Today, August 30 | 0 published items | 20 reads; 0 plays | 0 approvals, likes, comments, favorites, shares, or reposts | 4 profile visitors; 0 follower events | New calendar-day counter | Chrome logged-in creator data center |
| CSDN | Account cumulative | 5 originals | 1,189 total visits | 28 likes; 0 comments; 23 favorites | 0 followers; 6 following | +13 total visits; other exposed metrics unchanged | Chrome logged-in author pages; total visits equal the five visible article-read counters |
| Juejin | Account cumulative | 6 articles | 118 total reads | Account-wide likes, comments, favorites, and shares not exposed | 0 followers | +15 total reads; article and follower counts unchanged | Chrome logged-in account summary card |
| DEV Community | Account cumulative and last 7 days | 4 posts | <500 total post views; 40 readers in the last 7 days | 0 total reactions; 0 total comments; 0 reactions/comments/bookmarks in the last 7 days | 0 followers; 0 new followers in the last 7 days | No change | Chrome logged-in dashboard and analytics |
| Medium | August 2026 account stats | 2 listed stories | 21 presentations; 6 views; 1 read | Account-wide claps, responses, and bookmarks not exposed in this stats view | 0 followers; 0 subscribers | +1 presentation; other metrics unchanged | Chrome logged-in Medium stats |
| Reddit | Account profile | 20 contributions; active in 8 communities | Account-wide post/comment views not exposed | 12 karma; 0 gold earned | 0 followers; account age 2 years | First account-wide Reddit capture under the new scope | Chrome logged-in Reddit profile |
| GitHub Discussions | All public Discussions authored by `yangbobo2021` | 6 authored Discussions | Account-wide views not exposed | 2 total replies across the six Discussions; 0 external replies; 2 owner replies; aggregate upvotes/reactions not exposed | Participant totals are per Discussion, not account-wide | Scope expanded from three tracked entries to all six authored Discussions | Chrome logged-in GitHub Discussions search plus previously verified reply ownership |

Counter notes:

- Zhihu creator data center and profile achievement counters remain separate.
  At this snapshot the profile achievement panel shows 45 approvals, 6 likes,
  and 47 favorites, while the creator data center shows 43 approvals, 1 like,
  and 46 favorites.
- CSDN's visible five article-read counters sum to 1,189 and are used as the
  account total because the current author-list render did not show a separate
  total-visits card.
- GitHub's platform-native Discussions search exposes six authored Discussions
  and their reply counts, but no account-wide views, upvotes, reactions, or
  participant total.

## Platform-Wide Update Template

Use this table for future routine snapshots. Do not add single-content rows
unless the user explicitly requests item-level tracking.

| Snapshot time | Platform | Account scope | Published content / activity | Reads / views / reach | Likes / approvals / reactions | Comments / replies | Favorites / bookmarks | Shares / reposts | Followers / audience | Data source | Delta / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Historical Single-Item Update Template

Use this table for later snapshots. Keep one row per item per snapshot time.

| Snapshot time | Platform | Item URL | Reads / views | Likes / score / reactions | Upvote ratio | Reposts | Total comments / replies / responses | External comments / replies | Owner replies | Unique external participants | Favorites / saves | Followers / subscribers | Data source | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2026-08-27 16:28 CST | Zhihu | Five latest activity answers |  | 0 |  |  | 0 | 0 | 0 | 0 |  |  | Logged-in embedded page data | Per answer; not account-wide |
| 2026-08-27 16:28 CST | CSDN | `https://blog.csdn.net/nethider/article/details/164098601` | 95 | 1 |  |  | 0 | 0 | 0 | 0 | 1 | 0 | Logged-in page and author page | Author total visits: 1,019 |
| 2026-08-27 16:21 CST | Juejin | `https://juejin.cn/post/7678220784615391284` | 5 |  |  |  |  |  |  |  |  | 0 | Public article page | Author total reads: 44 |
| 2026-08-27 16:28 CST | DEV Community | `https://dev.to/yangbobo2021/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-pk3` | <25 | 0 |  |  | 0 | 0 | 0 | 0 |  | 0 | Logged-in page | Four published DEV articles share this baseline |
| 2026-08-27 16:21 CST | Medium | `https://medium.com/@ybb_y1b1b1/i-built-a-deepseek-harness-plugin-that-installs-other-plugins-from-chat-51b27922a00e` |  |  |  |  | 0 | 0 | 0 | 0 |  | 0 | Public article page | Views/reads/claps unavailable publicly |
| 2026-08-27 16:28 CST | Reddit | `https://www.reddit.com/r/DeepSeek/comments/1vz0dkf/i_made_a_dsh_plugin_that_finds_and_installs_other/` | 2.2K | 5 | 100% | 1 | 9 | 5 | 4 | 3 |  |  | Logged-in post insights | External participants listed above |
| 2026-08-27 16:28 CST | Reddit | `r/DeepSeekHarness` repost |  | >=1 |  |  | 0 | 0 | 0 | 0 |  |  | Logged-in Reddit page | Pending exact URL |
| 2026-08-27 16:28 CST | GitHub Discussions | `https://github.com/yangbobo2021/Relay/discussions/1` |  |  |  |  | 1 | 0 | 1 | 0 |  |  | Logged-in / public Discussion | Relay `#1`; 1 participant |
| 2026-08-27 16:28 CST | GitHub Discussions | `https://github.com/deepseek-ai/deepseek-harness/discussions/4561` |  |  |  |  | 1 | 0 | 1 | 0 |  |  | Local tracker and public Discussion | DSH suite post |
| 2026-08-27 16:28 CST | GitHub Discussions | `https://github.com/deepseek-ai/deepseek-harness/discussions/4660` |  |  |  |  | 0 | 0 | 0 | 0 |  |  | Public Discussion | Plugin Manager-specific post; 1 participant |

## Collection Notes

- Public counters can lag and may differ from logged-in creator analytics.
- Reddit vote counts can be hidden or fuzzed publicly; this baseline uses
  logged-in post insights for views, score, upvote ratio, reposts, and comment
  split.
- DEV views are recorded as the platform's `<25 views` bucket, not as zero.
- Medium public pages expose responses and author follower count, but detailed
  views/reads/claps usually require the author dashboard.
- Zhihu latest-answer zeros must be interpreted narrowly: these five new
  answers have 0赞同 and 0评论 at baseline, while older account content already
  has赞同.
