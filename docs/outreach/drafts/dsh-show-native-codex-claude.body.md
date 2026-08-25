I built two independent DSH plugins that add **Codex** and **Claude Code** to
the New Session mode menu while keeping DSH's own conversation UI, approvals,
questions, history, and session navigation.

They are regular installable plugins. The official DSH source checkout is not
patched or forked.

![Codex and Claude Code in the DSH New Session mode menu](https://raw.githubusercontent.com/yangbobo2021/relay-dsh-plugin-codex/main/docs/images/dsh-new-session-backends.jpg)

_Captured from official DeepSeek Harness at commit `b150a55` / release
`0.1.1-rc.2` with both plugins installed._

## What is different

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

## Install the two conversation modes

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

## Evidence and boundaries

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

## Looking for five real testers

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
