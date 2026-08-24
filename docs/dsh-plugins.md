# Relay Plugins for DeepSeek Harness

English | [中文](dsh-plugins.zh.md)

Add Codex, Claude Code, workspace files, and an interactive terminal to the
official DeepSeek Harness through plugins. No DSH fork or core patch is
required.

![Relay DSH plugin suite demo](media/dsh-plugin-suite-demo.gif)

This is a real run against a clean official DSH `0.1.1-rc.2` profile. All five
packages were installed from npm: Codex App Server and Claude Agent SDK each
returned a live response, Files opened this repository's `README.md`, and the
Terminal executed a command in the Relay workspace.

[Watch or download the H.264 MP4](media/dsh-plugin-suite-demo.mp4?raw=1) ·
[Open the full-size live screenshot](media/dsh-plugin-suite-live.png) ·
[Read the recording and compatibility evidence](acceptance/dsh-plugin-demo-qa.md)

## Choose What You Need

| Goal | Install | Notes |
| --- | --- | --- |
| Start Codex conversations in DSH | [`relay-dsh-plugin-codex`](https://github.com/yangbobo2021/relay-dsh-plugin-codex) | Independent backend powered by Codex App Server. |
| Start Claude Code conversations in DSH | [`relay-dsh-plugin-claude`](https://github.com/yangbobo2021/relay-dsh-plugin-claude) | Independent backend powered by Claude Agent SDK. |
| Browse workspace files | [`relay-dsh-plugin-workbench`](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) + [`relay-dsh-plugin-files`](https://github.com/yangbobo2021/relay-dsh-plugin-files) | Files uses the shared Workbench side-panel host. |
| Open a terminal panel | Workbench + [`relay-dsh-plugin-terminal`](https://github.com/yangbobo2021/relay-dsh-plugin-terminal) | Add Codex or another provider for a live shell. |
| Build another side or bottom view | Workbench | Use its public contracts instead of importing another feature plugin. |

The Codex and Claude plugins do not depend on Relay Events or Workbench. Files
and Terminal depend only on Workbench's public plugin contract. Relay Events is
a separate optional runtime and is not required for any plugin on this page.

## Install From npm

The backend plugins currently recommend their tested release candidates while
DSH remains in preview. The Workbench plugins use their stable releases.

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@next \
  relay-dsh-plugin-claude@next \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest

pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 web
```

Install only the rows you need. Files and Terminal must list Workbench in the
same command because DSH profiles intentionally reject GitHub packages hidden
as transitive dependencies. A live terminal also needs a provider; Codex is the
currently published provider in this suite.

## Install From GitHub

Use GitHub installs to test the newest unreleased code. Pin a tag or commit SHA
for reproducible environments instead of leaving `#main` in production.

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-codex#main \
  github:yangbobo2021/relay-dsh-plugin-claude#main \
  github:yangbobo2021/relay-dsh-plugin-workbench#main \
  github:yangbobo2021/relay-dsh-plugin-files#main \
  github:yangbobo2021/relay-dsh-plugin-terminal#main
```

Restart DSH Web after installing, updating, or removing plugins.

## Verify the Installation

```bash
dsh plugin --profile web why relay-dsh-plugin-codex
dsh plugin --profile web why relay-dsh-plugin-claude
dsh plugin --profile web why relay-dsh-plugin-files
dsh plugin --profile web why relay-dsh-plugin-terminal
```

Then open a new DSH session. Codex and Claude Code should appear in the mode
menu. With a workspace selected, the Workbench menu should expose Files and
Terminal.

Each repository includes English and Chinese setup, troubleshooting, CI against
an immutable official DSH commit, npm Tag publishing, and a GitHub development
install path. See the longer article,
[No Fork Required: Add Codex, Claude Code, Files, and Terminal to DSH](articles/no-fork-dsh-plugins.md),
for the design rationale and a guided walkthrough.

For the working model rather than package structure, read the
[Turning DSH into a Multi-Agent Project Workbench series](articles/dsh-agent-workbench-series.md):
it starts with task choice across native DSH, Codex, and Claude, then covers App
Server, Claude Sessions, the project Workbench, and the boundary for future
coordination.
