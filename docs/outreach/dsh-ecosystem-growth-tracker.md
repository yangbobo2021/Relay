# DSH Plugin Ecosystem Growth Tracker

Baseline date: 2026-08-26 (Asia/Shanghai)

This tracker covers six independent DeepSeek Harness plugins:

- `relay-dsh-plugin-codex`
- `relay-dsh-plugin-claude`
- `relay-dsh-plugin-workbench`
- `relay-dsh-plugin-files`
- `relay-dsh-plugin-terminal`
- `relay-dsh-plugin-manager`

The objective is official-ecosystem discovery, real installation feedback, and
measurable user conversion. Raw GitHub Traffic clones and unique cloners are
diagnostic only because CI and delayed reporting can distort them.

## Authority Boundary

Repository-local preparation may be completed directly. The following actions
require explicit confirmation in the current conversation immediately before
execution:

- changing GitHub Topics, About fields, repository settings, or npm metadata;
- publishing or editing a GitHub Discussion;
- joining a Discord server, posting a Discord message, or replying to anyone;
- reacting to, commenting on, or closing an external Issue or Discussion;
- publishing an npm release or changing an npm dist-tag.

No public post, reply, reaction, or external-platform modification has been made
as part of this baseline.

## Repository Baseline

All six paths are Git submodules of Relay. On 2026-08-26 they were initialized
in this worktree at the Relay-pinned commit, and each pinned commit matched its
repository's `origin/main`.

| Plugin | Relay path | Pinned and remote `main` | GitHub Topics | GitHub About | GitHub Stars | npm state | README first-screen state | Follow-up |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| Codex | `integrations/codex` | `ef65b29dd52c` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `codex`, `openai`, `ai-agent`, `typescript` | Description is specific; homepage points to npm | 1 | `latest=0.1.2`, `next=0.1.2-rc.1`; repository/homepage/bugs present | Hero capability demo remains primary; English and Chinese first screens link their matching localized Plugin Manager install demos | No metadata correction required now |
| Claude | `integrations/claude` | `6e8f9acd84d5` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `claude-code`, `anthropic`, `ai-agent`, `typescript` | Description is specific; homepage points to npm | 1 | `latest=0.1.0`, `next=0.1.1-rc.2`; repository/homepage/bugs present | Hero demo and package link are above the fold; exact install commands are under Quick Start | Clearly distinguish stable and prerelease in outreach |
| Workbench | `integrations/dsh-workbench` | `07fa06d88942` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `workbench`, `react`, `typescript` | Description is specific; homepage points to npm | 0 | `latest=0.1.0`; released package lacks repository/homepage/bugs; source fixed on `main` | Hero demo and package link are above the fold; README correctly says the shell has no visible feature alone | Carry source metadata into the next normal release |
| Files | `integrations/dsh-files` | `e676da231412` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `file-explorer`, `workbench`, `typescript` | Description is specific; homepage points to npm | 0 | `latest=0.1.0`; released package lacks repository/homepage/bugs; source fixed on `main` | Hero demo and package link are above the fold; npm and GitHub install paths are explicit | Carry source metadata into the next normal release |
| Terminal | `integrations/dsh-terminal` | `09ed18a80284` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `terminal`, `workbench`, `xterm`, `typescript` | Description is specific; homepage points to npm | 0 | `latest=0.1.0`; released package lacks repository/homepage/bugs; source fixed on `main` | Hero demo and package link are above the fold; provider requirement is stated before install | Carry source metadata into the next normal release |
| Plugin Manager | `integrations/dsh-plugin-manager` | `4b1a6ef73a26` | `dsh-plugin`, `deepseek-harness`, `dsh`, and `plugin-manager` added | Description is specific; homepage points to npm | 0 | `next=0.1.0-rc.2`, `latest=0.1.0-rc.1`; source `main` is preparing unreleased RC.3 Marketplace help | Bilingual newcomer path, Settings help, ordinary-language examples, confirmation boundary, and a clickable real-install poster targeting the English-captioned MP4 | Wait for GitHub Topic and npm search indexes; do not describe source RC.3 as published |

Notes:

- GitHub About homepages already point to the matching npm package for all six
  repositories. Do not change them merely for consistency.
- The npm pages for Workbench, Files, and Terminal cannot link back to their
  repositories until `repository`, `homepage`, and `bugs` are added to their
  package manifests and a new version is published.
- The README hero links to Relay's default branch
  `codex/relay-foundation`; the target article, GIF, and MP4 paths were present
  when checked.

## Official Channel Baseline

| Surface | Verified state | Rule or constraint | Readiness |
| --- | --- | --- | --- |
| DSH repository | `deepseek-ai/deepseek-harness`; 195,175 Stars; latest npm and GitHub prerelease `0.1.1-rc.2`; default branch `master` | Developer preview with compatibility-breaking changes | Ready as the compatibility reference |
| DSH README | Community section explicitly asks third-party plugin repositories to add Topic `dsh-plugin` | This is the official discovery requirement | Topic added and verified through repository metadata on all six repositories; search-index appearance remains a separate check |
| DSH CONTRIBUTING | Encourages plugin creation, `dsh-plugin` discovery, guides, and community help; external PRs are not currently accepted | Promotion should be an ecosystem contribution, not a request to merge plugin code upstream | Draft follows this positioning |
| GitHub Discussions | Category `Show Your Plugins!` exists with description “Show off something you've made” | Recent posts commonly use a result-first explanation, exact install command, evidence, repository link, and a specific feedback request | Published as [Discussion #4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561); the tested Plugin Manager release and English demo were added in [comment #18164020](https://github.com/deepseek-ai/deepseek-harness/discussions/4561#discussioncomment-18164020) |
| Discord | Official invite resolves to the DeepSeek server and authenticated access to the `harness` forum was verified; the server showed about 29.3K members and 2.1K online | Rules prohibit unauthorized advertising or self-promotion and require moderator permission. The preferred language is English. The server is not an official support channel. Forum posting requires parent-channel send permission; this account can reply in threads but its `New Post` button is disabled | Promotion-permission DM delivered to `Moderator-ZANE` (`truongdinhdat15`) at 08:28 Asia/Shanghai on 2026-08-26; a focused role/channel-permission follow-up was delivered at 09:07. Recruitment remains gated on forum posting access |

The `Show Your Plugins!` category is high-volume. A single concise suite post is
preferable to near-duplicate announcements. Follow-up comments should only
be added when there is a real release, confirmed platform result, or resolved
user issue. An exact-name search on 2026-08-26 found no existing official DSH
Discussion for any of the original five package names. The Plugin Manager was
created after that baseline and was added to the official post in a substantive
follow-up comment after its RC.2 release and real install demo passed review.

### Plugin Manager Discoverability Check

| Surface | Verified 2026-08-26 | Remaining check |
| --- | --- | --- |
| GitHub repository metadata | Exact `dsh-plugin` Topic plus `deepseek-harness`, `dsh`, and `plugin-manager`; About homepage points to npm | Confirm the repository appears in GitHub's eventually consistent `topic:dsh-plugin` search index |
| npm package metadata | `0.1.0-rc.2` is public on `next` with `dsh-plugin`, `deepseek-harness`, `dsh`, `plugin-manager`, and `ai-agent` keywords | Confirm npm's eventually consistent search endpoint returns the package for `keywords:dsh-plugin`; do not move a prerelease to `latest` merely to influence ranking |
| Repository documentation | Bilingual newcomer path, Marketplace help, ordinary-language examples, safety boundary, and a clickable accepted poster targeting the English-captioned 37.8-second MP4 | Ready as the evidence link for a dedicated community announcement; keep recorded RC.2 distinct from unreleased source RC.3 |
| Release evidence | Prerelease page and trusted npm publication succeeded; full local verification passed against official DSH commit `b150a551` | Collect first external macOS, Windows, and Linux installation reports |

## Public-Content Gate

Every proposed public item must pass all four checks before it is submitted for
user approval:

1. Accuracy: package versions, DSH version, supported behavior, validation
   platform, and limitations match repository evidence.
2. Community rules: correct channel/category, no duplicate or off-topic post,
   and any server-specific rules or pinned guidance have been read.
3. Links: every repository, npm, install, issue, and media URL returns the
   intended public resource.
4. Visuals: the artifact is readable, is real product evidence, contains no
   secret or private customer data, and does not imply a broader platform test
   than was actually performed.

Only after those four checks pass should the current conversation request a
specific publish/modify confirmation.

## Visual Asset Review

| Asset | Result | Use |
| --- | --- | --- |
| `integrations/codex/docs/images/dsh-new-session-backends.jpg` | Clear 1280x720 proof that Codex and Claude Code appear in the DSH mode menu; no secret or customer data. It says `DSH Local Build` and shows commit `b150a55`, so the caption must disclose that it is a build of official DSH at the tested commit. | Recommended hero for the GitHub Discussion |
| `docs/media/dsh-plugin-suite-demo.mp4` | Real 33.4-second H.264 npm-installed demo; technically valid and already acceptance-checked. The terminal scene exposes a local username, host name, shell-history warning, and environment prompt. | Do not embed in the official post until a sanitized recording replaces the terminal scene |
| `docs/media/dsh-plugin-suite-demo.gif` | Real 15-second summary of the same accepted run, but derives from the same recording. | Secondary only after privacy/readability recheck |
| `docs/media/dsh-plugin-manager-codex-install-demo.en.mp4` | Real 37.8-second isolated run with burned-in English event captions: exact Codex package search, plan-only safety boundary, explicit confirmation, npm install, and final `succeeded` status. H.264 QA passed and no secret, local username, host, or private path is visible. | Current official-community version; linked from the Plugin Manager and Codex English READMEs |
| `docs/media/dsh-plugin-manager-codex-install-demo.zh.mp4` | The same accepted 37.8-second run with separate burned-in Simplified Chinese event captions; full decode, black-frame, event-sheet, and privacy QA passed independently. | Chinese distribution version; linked from the Codex Chinese README and reserved for separate Chinese-channel use |
| `docs/media/dsh-plugin-manager-codex-install-demo.mp4` | Uncaptioned accepted base used to derive both localized versions. | Preserve as the acceptance source; do not use as the current official-community link |
| `docs/media/dsh-plugin-suite-live.png` | Clear Codex + Files evidence with no secret; does not prove Claude or all five plugins by itself. | Suitable as a follow-up visual, not the total-post hero |
| Individual Files/Terminal screenshots | Files is clean. The standalone Terminal screenshot demonstrates the no-provider state, not the complete live-shell value. | Use in single-problem follow-ups, with an accurate caption |

## Seven-Day Conversion Scorecard

Day 0 is the moment the first official Discussion is published, not the date the
draft is created.

| Metric | Baseline | Day-7 target | Counting rule |
| --- | ---: | ---: | --- |
| External official-Discussion interactions | 0 | 5 | Unique non-owner comments or substantive replies; reactions alone are diagnostic |
| Codex Stars | 1 | 4 | Net GitHub Stars; exclude owner accounts |
| Claude Stars | 1 | 4 | Net GitHub Stars; exclude owner accounts |
| Real installation reports | 0 collected in this campaign | 5 | Must state platform and an observed result or failure |
| Platform coverage | 0/3 collected in this campaign | macOS, Windows, Linux | At least one real report per OS family; recruitment allocation is macOS 2, Windows 2, Linux 1 |
| Real Issues | 0 open across the six repositories | 1-3 | User-created, reproducible or actionable; do not manufacture Issues |

Daily log template:

| Day/date | Discussion interactions | Codex Stars | Claude Stars | Install reports (macOS/Windows/Linux) | New real Issues | Evidence links | Decision |
| --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| D0 / 2026-08-26 | 0 | 1 | 1 | 0 / 0 / 0 | 0 | [Discussion #4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561), [Plugin Manager update](https://github.com/deepseek-ai/deepseek-harness/discussions/4561#discussioncomment-18164020) | Discussion published at 07:25:58; tested Manager RC.2 and English demo added at 22:52 Asia/Shanghai; the owner comment does not count as an external interaction |
| D1 |  |  |  |  |  |  |  |
| D3 |  |  |  |  |  |  |  |
| D7 |  |  |  |  |  |  |  |

### GitHub Traffic Snapshot

Pulled from the GitHub Traffic API at 2026-08-26 08:26 Asia/Shanghai. The
returned 14-day window ended at 2026-08-24 UTC, so it does not yet include the
official Discussion published on 2026-08-26. Unique counts below are per
repository and must not be summed as cross-repository unique people.

| Repository | Views / unique visitors | Clones / unique cloners | External Stars | Real Issues | Notable referrers |
| --- | ---: | ---: | ---: | ---: | --- |
| Relay | 19 / 3 | 100 / 62 | 0 | 0 | `github.com` 3 / 2 unique |
| Codex | 20 / 6 | 135 / 60 | 1 | 0 | `github.com` 8 / 1; `chatgpt.com` 4 / 1; `reddit.com` 2 / 2 |
| Claude | 23 / 7 | 75 / 38 | 1 | 0 | `github.com` 12 / 3; `npmjs.com` 9 / 2 |
| Workbench | 3 / 2 | 72 / 28 | 0 | 0 | `github.com` 2 / 1 |
| Files | 2 / 2 | 33 / 20 | 0 | 0 | No referrer met GitHub's reporting threshold |
| Terminal | 1 / 1 | 83 / 45 | 0 | 0 | No referrer met GitHub's reporting threshold |
| Plugin Manager | 0 / 0 | 0 / 0 | 0 | 0 | Repository created on 2026-08-26; Traffic had not populated yet |

The per-repository totals are 68 views and 498 clones. The clone-to-view ratio,
especially the one-day clone spikes across the submodules, is consistent with
CI, submodule validation, and repeated automated installs. Clone and unique
cloner counts remain diagnostic only. Trusted campaign conversion remains
external Stars, non-owner comments, real installation reports, actionable
Issues, and cross-platform acceptance results.

At pull time, Codex's external Star was from `wewqasd` (2026-08-25 03:44 UTC)
and Claude's was from `konglinghai123` (2026-08-24 08:19 UTC). Discussion #4561
had zero comments and zero reactions; its single total upvote was not counted as
an external interaction because voter identity was unavailable.

## Execution Checklist

### Repository-local work: may execute directly

- [x] Initialize and verify all six submodules in the current Relay worktree.
- [x] Confirm every pinned commit matches the corresponding remote `main`.
- [x] Audit GitHub Topics, About metadata, npm metadata, README install paths,
  demo entry points, and current Stars.
- [x] Audit official DSH README, CONTRIBUTING, Discussion category, current
  release, and Discord invite status.
- [x] Prepare the English GitHub Discussion draft.
- [x] Prepare the Discord tester-recruitment draft.
- [x] Add `repository`, `homepage`, and `bugs` to Workbench, Files, and Terminal
  package manifests; verify, commit, and push each child repository.
- [x] Validate the three plugins against official DSH commit `b150a551`, run
  independent package-entry verification, and pass all nine isolated/combined
  official DSH installation scenarios.
- [ ] Record a sanitized 30-60 second suite demo with no local username, host,
  shell-history warning, or distracting environment prompt.
- [ ] Produce six single-problem 30-60 second assets: Codex import, Claude
  conversation, Files, Terminal, Workbench extension, and Plugin Manager search.
  The 37.8-second Plugin Manager search/install asset is complete; five remain.
- [ ] Add a small installation-report template to the six Issue templates or
  shared outreach docs without claiming unverified platform support.

### External actions: explicit current-conversation confirmation required

- [x] Add Topic `dsh-plugin` to all six GitHub repositories.
- [x] Publish the English total post in DSH `Show Your Plugins!` as
  [Discussion #4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561).
- [x] Add the tested Plugin Manager RC.2 and English-captioned real install demo
  as [comment #18164020](https://github.com/deepseek-ai/deepseek-harness/discussions/4561#discussioncomment-18164020).
- [x] Recheck the Discord invite and authenticated server/channel rules.
- [x] Ask a server moderator for permission to publish one tester-recruitment
  post in `#harness` with the `Show and tell` tag.
- [ ] Publish the Discord five-tester recruitment message.
- [ ] Reply to comments or installation reports.
- [x] Update the Plugin Manager's GitHub About/Topics, npm metadata, and RC.2
  prerelease; keep the prerelease on npm `next`.

## Prepared Drafts

- `docs/outreach/drafts/dsh-show-native-codex-claude.en.md`
- `docs/outreach/drafts/dsh-discord-testers.en.md`

## Activity Log

### 2026-08-26

- Corrected the initial worktree assumption: the five plugin repositories are
  Git submodules, but they had not yet been initialized in this linked worktree.
- Initialized the five submodules at Relay's recorded commits; no external
  repository was modified.
- Confirmed the exact `dsh-plugin` Topic is absent from all five repositories.
- Confirmed Codex and Claude each have one Star; the other three have zero.
- Confirmed Workbench, Files, and Terminal npm metadata omit repository/homepage/
  bugs fields even though GitHub About pages point to npm correctly.
- Confirmed official DSH ecosystem rules and prepared two unpublished drafts.
- Reached HTTP 200 for all GitHub, release, suite-guide, and raw-image URLs in
  the Discussion draft. npm's web pages returned an automated-access 403, so
  package existence, versions, dist-tags, repository, homepage, and bugs links
  were verified through the public npm registry instead.
- Added and verified Topic `dsh-plugin` on all five plugin repositories.
- Published the checked English total post as DSH Discussion
  [#4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561).
- Added npm repository/homepage/bugs source metadata to Workbench (`07fa06d`),
  Files (`e676da2`), and Terminal (`09ed18a`) and pushed each commit to its
  repository's `main` branch with GitHub noreply authorship.
- Verified Workbench 10/10 tests, Files 7/7 tests, Terminal 10/10 tests, six
  independently packed DSH plugin entries, and nine official DSH install/boot
  combinations against clean upstream commit `b150a551`.
- Added `relay-dsh-plugin-manager` as Relay's sixth plugin submodule and updated
  the public catalog, English/Chinese chooser, repository workflow, and plugin
  boundary documentation.
- Added and verified the Plugin Manager's canonical `dsh-plugin` Topic, related
  GitHub Topics, and npm homepage About link.
- Released `relay-dsh-plugin-manager@0.1.0-rc.2` on npm `next` with canonical
  discovery keywords. Trusted publication, CI, 41 tests, build, package
  acceptance, npm integrity metadata, and the prerelease page all passed.
- Recorded GitHub Topic search and npm search as pending index checks; the
  authoritative repository and package metadata are already live, but neither
  search index returned the new repository/package immediately after release.
- Added a structured GitHub installation-report form and matching label that
  collect OS, DSH/plugin/Node versions, the sanitized command, and the observed
  result without requesting secrets.
- Recorded and accepted a real 37.8-second Plugin Manager demo against official
  DSH commit `b150a551`: exact `relay-dsh-plugin-codex` search returned npm
  `0.1.2` and its GitHub source, the plan made no change, explicit confirmation
  triggered installation, and the final status was `succeeded` and enabled with
  a required DSH restart. The H.264 artifact passed full decode, black-frame,
  frame-boundary, contact-sheet, and privacy review.
- Published the accepted 1280x720 success poster on Relay and linked it to the
  MP4 above the Plugin Manager Quick Start (`8da22c2`). Added smaller secondary
  links to the Codex English and Chinese READMEs (`9f41289`) without replacing
  their capability-focused hero demo. Both public README files and both media
  URLs were fetched successfully after push.
- Produced separate burned-in English and Simplified Chinese versions of the
  accepted 37.8-second demo. Both remain H.264 High, 1280x720, 30 fps, yuv420p,
  faststart, and no-audio; both passed full 1,134-frame decode, black-frame,
  first/mid/last-frame, eight-event contact-sheet, caption-safe-area, and
  privacy review. English is now the Manager and Codex English README target;
  the Codex Chinese README targets the Chinese file (`ef65b29`).
- Integrated the Manager video-link update on top of the concurrently added,
  unreleased RC.3 Marketplace help (`4b1a6ef`) without force-pushing. The RC.3
  source passed 46 Vitest cases, four release tests, build, package packing,
  Marketplace client-tab checks, and official DSH acceptance at `b150a551`.
- Published the checked Plugin Manager update as
  [Discussion comment #18164020](https://github.com/deepseek-ai/deepseek-harness/discussions/4561#discussioncomment-18164020),
  with the English-captioned 37.8-second MP4, exact tested versions, pinned
  install command, restart note, repository link, installation-report form, and
  five-tester request. GitHub rendered the comment as the first reply and the
  video attachment successfully. This owner-authored comment remains excluded
  from the external-interaction metric.
