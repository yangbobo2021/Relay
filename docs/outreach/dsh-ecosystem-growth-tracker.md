# DSH Plugin Ecosystem Growth Tracker

Baseline date: 2026-08-26 (Asia/Shanghai)

This tracker covers five independent DeepSeek Harness plugins:

- `relay-dsh-plugin-codex`
- `relay-dsh-plugin-claude`
- `relay-dsh-plugin-workbench`
- `relay-dsh-plugin-files`
- `relay-dsh-plugin-terminal`

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

All five paths are Git submodules of Relay. On 2026-08-26 they were initialized
in this worktree at the Relay-pinned commit, and each pinned commit matched its
repository's `origin/main`.

| Plugin | Relay path | Pinned and remote `main` | GitHub Topics | GitHub About | GitHub Stars | npm state | README first-screen state | Follow-up |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| Codex | `integrations/codex` | `7b3b723e9cf5` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `codex`, `openai`, `ai-agent`, `typescript` | Description is specific; homepage points to npm | 1 | `latest=0.1.1`, `next=0.1.1-rc.4`; repository/homepage/bugs present | Hero demo and package link are above the fold; exact install commands are under Quick Start | No metadata correction required now |
| Claude | `integrations/claude` | `6e8f9acd84d5` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `claude-code`, `anthropic`, `ai-agent`, `typescript` | Description is specific; homepage points to npm | 1 | `latest=0.1.0`, `next=0.1.1-rc.2`; repository/homepage/bugs present | Hero demo and package link are above the fold; exact install commands are under Quick Start | Clearly distinguish stable and prerelease in outreach |
| Workbench | `integrations/dsh-workbench` | `07fa06d88942` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `workbench`, `react`, `typescript` | Description is specific; homepage points to npm | 0 | `latest=0.1.0`; released package lacks repository/homepage/bugs; source fixed on `main` | Hero demo and package link are above the fold; README correctly says the shell has no visible feature alone | Carry source metadata into the next normal release |
| Files | `integrations/dsh-files` | `e676da231412` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `file-explorer`, `workbench`, `typescript` | Description is specific; homepage points to npm | 0 | `latest=0.1.0`; released package lacks repository/homepage/bugs; source fixed on `main` | Hero demo and package link are above the fold; npm and GitHub install paths are explicit | Carry source metadata into the next normal release |
| Terminal | `integrations/dsh-terminal` | `09ed18a80284` | `dsh-plugin` added; also has `deepseek-harness`, `dsh`, `plugin`, `terminal`, `workbench`, `xterm`, `typescript` | Description is specific; homepage points to npm | 0 | `latest=0.1.0`; released package lacks repository/homepage/bugs; source fixed on `main` | Hero demo and package link are above the fold; provider requirement is stated before install | Carry source metadata into the next normal release |

Notes:

- GitHub About homepages already point to the matching npm package for all five
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
| DSH README | Community section explicitly asks third-party plugin repositories to add Topic `dsh-plugin` | This is the official discovery requirement | Topic added and verified on all five repositories |
| DSH CONTRIBUTING | Encourages plugin creation, `dsh-plugin` discovery, guides, and community help; external PRs are not currently accepted | Promotion should be an ecosystem contribution, not a request to merge plugin code upstream | Draft follows this positioning |
| GitHub Discussions | Category `Show Your Plugins!` exists with description “Show off something you've made” | Recent posts commonly use a result-first explanation, exact install command, evidence, repository link, and a specific feedback request | Published as [Discussion #4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561) |
| Discord | Official invite resolves to the DeepSeek server and authenticated access to the `harness` forum was verified; the server showed about 29.3K members and 2.1K online | Rules prohibit unauthorized advertising or self-promotion and require moderator permission. The preferred language is English. The server is not an official support channel | Permission request sent by DM to `Moderator-ZANE` (`truongdinhdat15`) at 08:21 Asia/Shanghai on 2026-08-26; recruitment post remains gated on approval and forum posting access |

The `Show Your Plugins!` category is high-volume. A single concise suite post is
preferable to five near-duplicate announcements. Follow-up comments should only
be added when there is a real release, confirmed platform result, or resolved
user issue. An exact-name search on 2026-08-26 found no existing official DSH
Discussion for any of the five package names.

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
| Real Issues | 0 open across the five repositories | 1-3 | User-created, reproducible or actionable; do not manufacture Issues |

Daily log template:

| Day/date | Discussion interactions | Codex Stars | Claude Stars | Install reports (macOS/Windows/Linux) | New real Issues | Evidence links | Decision |
| --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| D0 / 2026-08-26 | 0 | 1 | 1 | 0 / 0 / 0 | 0 | [Discussion #4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561) | Discussion published at 07:25:58 Asia/Shanghai; begin seven-day window |
| D1 |  |  |  |  |  |  |  |
| D3 |  |  |  |  |  |  |  |
| D7 |  |  |  |  |  |  |  |

## Execution Checklist

### Repository-local work: may execute directly

- [x] Initialize and verify all five submodules in the current Relay worktree.
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
- [ ] Produce five single-problem 30-60 second assets: Codex import, Claude
  conversation, Files, Terminal, and Workbench extension.
- [ ] Add a small installation-report template to the five Issue templates or
  shared outreach docs without claiming unverified platform support.

### External actions: explicit current-conversation confirmation required

- [x] Add Topic `dsh-plugin` to all five GitHub repositories.
- [x] Publish the English total post in DSH `Show Your Plugins!` as
  [Discussion #4561](https://github.com/deepseek-ai/deepseek-harness/discussions/4561).
- [x] Recheck the Discord invite and authenticated server/channel rules.
- [x] Ask a server moderator for permission to publish one tester-recruitment
  post in `#harness` with the `Show and tell` tag.
- [ ] Publish the Discord five-tester recruitment message.
- [ ] Reply to comments or installation reports.
- [ ] Update GitHub About, npm metadata, releases, or dist-tags.

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
