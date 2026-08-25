# Unpublished Draft: DSH Show Your Plugins

Status: **prepared, not published**

Target: DeepSeek Harness GitHub Discussions → `Show Your Plugins!`

## Pre-publication check

| Check | Status | Evidence or remaining gate |
| --- | --- | --- |
| Accuracy | PASS | Current DSH release is `0.1.1-rc.2`; Codex `latest` is `0.1.1`; Claude `next` is `0.1.1-rc.2`; the accepted npm-installed suite used official DSH without modifying its source checkout |
| Community rules | PASS | Official README and CONTRIBUTING encourage third-party plugins, Topic `dsh-plugin`, guides, and community help; `Show Your Plugins!` is the exact category |
| Links | PASS | GitHub, raw image, Relay suite, and DSH release URLs returned HTTP 200 on 2026-08-26. npm web pages blocked the automated request with 403, so package existence, versions, dist-tags, repository, homepage, and bugs URLs were verified through the public npm registry |
| Visual | PASS with caption | Use the real mode-menu screenshot below. Its visible `DSH Local Build` label must be explained as official DSH at commit `b150a55`, not a fork |
| External authorization | WAITING | Publishing requires explicit confirmation in the current conversation |

Do not substitute the current full-suite terminal video without another privacy
check; it contains a local username/host and a shell-history warning.

## Proposed title

Show: Add Codex App Server and Claude Code as native DSH conversation modes — without forking DSH

## Proposed body

I built two independent DSH plugins that add **Codex** and **Claude Code** to
the New Session mode menu while keeping DSH's own conversation UI, approvals,
questions, history, and session navigation.

They are regular installable plugins. The official DSH source checkout is not
patched or forked.

![Codex and Claude Code in the DSH New Session mode menu](https://raw.githubusercontent.com/yangbobo2021/relay-dsh-plugin-codex/main/docs/images/dsh-new-session-backends.jpg)

_Captured from official DeepSeek Harness at commit `b150a55` / release
`0.1.1-rc.2` with both plugins installed._

### What is different

- **Codex mode** binds one ordinary DSH Session to one Codex App Server Thread.
  It supports streaming, reasoning, tool activity, approvals, questions,
  interruption, images, session continuation, and workspace-level import of
  existing Codex conversations.
- **Claude Code mode** binds one ordinary DSH Session to one Claude Agent SDK
  session. It supports streaming thinking and answers, tool activity,
  approvals, questions, interruption, model selection, and session continuity.
- Neither plugin replaces DSH's default modes. Install one or both.
- Three optional view plugins add a shared Workbench shell, a workspace Files
  panel, and a provider-neutral Terminal panel.

### Install the two conversation modes

The following versions are the ones I want this test cohort to use: Codex
`0.1.1` from `latest`, Claude `0.1.1-rc.2` from `next`, and DSH
`0.1.1-rc.2`.

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@latest \
  relay-dsh-plugin-claude@next

npx @deepseek-ai/dsh@0.1.1-rc.2 web
```

Codex and Claude Code authentication must already work for the same local user
that runs DSH. The repositories explain the authentication and stable/prerelease
choices in detail.

### Evidence and boundaries

The five-package suite was installed from npm into a clean profile created by
official `@deepseek-ai/dsh@0.1.1-rc.2`. The test used no local tarball,
workspace link, source checkout, or DSH core patch. Live acceptance covered a
Codex reply, a Claude reply, workspace file preview, and a real terminal command.

The plugins are independent repositories and do not require the Relay event
runtime:

- Codex: https://github.com/yangbobo2021/relay-dsh-plugin-codex
- Claude Code: https://github.com/yangbobo2021/relay-dsh-plugin-claude
- Workbench: https://github.com/yangbobo2021/relay-dsh-plugin-workbench
- Files: https://github.com/yangbobo2021/relay-dsh-plugin-files
- Terminal: https://github.com/yangbobo2021/relay-dsh-plugin-terminal
- Suite guide and acceptance media: https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.md

### Looking for five real testers

I am looking for **2 macOS, 2 Windows, and 1 Linux** testers. A successful report
is just as useful as a bug report.

If you try either conversation plugin, please report:

```text
OS and architecture:
Node version:
DSH version:
Plugin and resolved version:
Authentication method already working locally: Codex / Claude Code
Result: installed / mode appeared / first reply / resume after restart
Failure or unexpected behavior:
```

Please open reproducible failures in the matching repository's Issues. For a
successful install, a short reply here with the platform and observed result is
enough. I will summarize confirmed platform results and fixes in this Discussion
instead of creating duplicate announcement posts.

## Link-check inventory

- https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2
- https://github.com/yangbobo2021/relay-dsh-plugin-codex
- https://www.npmjs.com/package/relay-dsh-plugin-codex
- https://github.com/yangbobo2021/relay-dsh-plugin-claude
- https://www.npmjs.com/package/relay-dsh-plugin-claude
- https://github.com/yangbobo2021/relay-dsh-plugin-workbench
- https://github.com/yangbobo2021/relay-dsh-plugin-files
- https://github.com/yangbobo2021/relay-dsh-plugin-terminal
- https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.md
- https://raw.githubusercontent.com/yangbobo2021/relay-dsh-plugin-codex/main/docs/images/dsh-new-session-backends.jpg
