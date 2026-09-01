# Relay Plugins for DeepSeek Harness

English | [中文](dsh-plugins.zh.md)

> **All 10 Relay plugins now support the latest DSH `0.1.2-alpha.3`.** Stable
> `0.2.1` is verified on `0.1.2-alpha.3`, `0.1.2-alpha.2`, and `0.1.1-rc.2`.
> Install the complete suite below or choose only the capabilities you need.

Discover and manage plugins from a conversation, or add Codex, Claude Code,
workspace files, and an interactive terminal to the official DeepSeek Harness.
No DSH fork or core patch is required.

![Codex conversation and workspace files running in official DSH](media/dsh-plugin-suite-live.png)

The screenshot shows a live Codex App Server reply beside the Files view on a
clean official DSH `0.1.1-rc.2` profile. The same real run, from an actual npm installation,
also verified a live Claude Agent SDK reply and a Terminal command in the Relay
workspace.

[Watch Plugin Manager install Codex in 40 seconds](media/dsh-plugin-manager-codex-install-demo.en.mp4?raw=1) ·
[Open the full-size live screenshot](media/dsh-plugin-suite-live.png) ·
[Read the recording and compatibility evidence](acceptance/dsh-plugin-demo-qa.md)

## Choose What You Need

| Goal | Install | Notes |
| --- | --- | --- |
| Find, install, update, or remove DSH plugins through Chat | [`relay-dsh-plugin-manager`](https://github.com/yangbobo2021/relay-dsh-plugin-manager) | Searches npm and GitHub; every mutation requires separate confirmation, and Settings remains read-only help. |
| Start Codex conversations in DSH | [`relay-dsh-plugin-codex`](https://github.com/yangbobo2021/relay-dsh-plugin-codex) | Independent backend powered by Codex App Server. |
| Start Claude Code conversations in DSH | [`relay-dsh-plugin-claude`](https://github.com/yangbobo2021/relay-dsh-plugin-claude) | Independent backend powered by Claude Agent SDK. |
| Browse workspace files | [`relay-dsh-plugin-workbench`](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) + [`relay-dsh-plugin-files`](https://github.com/yangbobo2021/relay-dsh-plugin-files) | Files uses the shared Workbench side-panel host. |
| Open a terminal panel | Workbench + [`relay-dsh-plugin-terminal`](https://github.com/yangbobo2021/relay-dsh-plugin-terminal) | Add Codex or another provider for a live shell. |
| Build another side or bottom view | Workbench | Use its public contracts instead of importing another feature plugin. |
| Import existing provider sessions | [`relay-dsh-plugin-session-import`](https://github.com/yangbobo2021/relay-dsh-plugin-session-import) | Shared import surface used by the Codex and Claude providers. |
| Receive external events in an existing DSH Session | [`relay-dsh-plugin-events`](https://github.com/yangbobo2021/relay-dsh-plugin-events) | Durable Wait, Event, and Delivery runtime. |
| Watch systems that cannot push events | Events + [`relay-dsh-plugin-monitors`](https://github.com/yangbobo2021/relay-dsh-plugin-monitors) | Runs restricted durable monitors and emits normal Relay Events. |
| Route events with a DSH model | Events + [`relay-dsh-plugin-semantic-router`](https://github.com/yangbobo2021/relay-dsh-plugin-semantic-router) | Optional semantic routing for `deliver`, `escalate`, or `dismiss`. |

Plugin Manager, Codex, and Claude do not depend on the Relay runtime or
Workbench. Files and Terminal depend only on Workbench's public plugin contract.
Relay Events is a separate optional runtime and is not required by these plugins.

Install the conversation-first manager by itself, restart DSH once, then use
`/plugins` or an ordinary natural-language request:

```bash
npx @deepseek-ai/dsh@0.1.2-alpha.3 plugin --profile web add --save-exact \
  relay-dsh-plugin-manager@0.2.1
```

```text
/plugins find a plugin for Feishu
list installed plugins and whether DSH needs a restart
```

## Install From npm

All ten plugins use the same stable `0.2.1` release line. npm `latest` points to
`0.2.1`; `next` points to the `0.2.1-rc.1` release candidate.

```bash
pnpm dlx @deepseek-ai/dsh@0.1.2-alpha.3 plugin --profile web add \
  relay-dsh-plugin-manager@0.2.1 \
  relay-dsh-plugin-codex@0.2.1 \
  relay-dsh-plugin-claude@0.2.1 \
  relay-dsh-plugin-session-import@0.2.1 \
  relay-dsh-plugin-workbench@0.2.1 \
  relay-dsh-plugin-files@0.2.1 \
  relay-dsh-plugin-terminal@0.2.1 \
  relay-dsh-plugin-events@0.2.1 \
  relay-dsh-plugin-monitors@0.2.1 \
  relay-dsh-plugin-semantic-router@0.2.1

pnpm dlx @deepseek-ai/dsh@0.1.2-alpha.3 web
```

Install only the rows you need. Files and Terminal must list Workbench in the
same command because DSH profiles intentionally reject GitHub packages hidden
as transitive dependencies. A live terminal also needs a provider; Codex is the
currently published provider in this suite.

KeySync's one-click DSH setup already installs Plugin Manager. Do not add it a
second time there; the npm command is for standalone official DSH Profiles.

## Install From GitHub

Use GitHub installs to test the newest unreleased code. Pin a tag or commit SHA
for reproducible environments instead of leaving `#main` in production.

```bash
pnpm dlx @deepseek-ai/dsh@0.1.2-alpha.3 plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-manager#main \
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
dsh plugin --profile web why relay-dsh-plugin-manager
```

Then open a new DSH session. Ask to list installed plugins, or open **Settings >
Plugins > Plugin marketplace** for concise usage help. Codex and Claude Code
should appear in the mode menu. With a workspace selected, the Workbench menu
should expose Files and Terminal.

All ten plugin repositories include English and Chinese setup and document
verification, npm publishing, and a GitHub development path. See the longer article,
[No Fork Required: Add Codex, Claude Code, Files, and Terminal to DSH](articles/no-fork-dsh-plugins.md),
for the design rationale and a guided walkthrough.

The Codex plugin also treats App Server reliability as a product contract: its
Settings status distinguishes startup, connection, runtime availability, and
rebind failures; blank-session model selection follows the chosen backend;
normal forks use App Server `thread/fork`; and invalid fork provenance or stale
approvals fail closed without silently creating a replacement Codex Thread.

For the working model rather than package structure, read the
[Turning DSH into a Multi-Agent Project Workbench series](articles/dsh-agent-workbench-series.md):
it starts with task choice across native DSH, Codex, and Claude, then covers App
Server, Claude Sessions, the project Workbench, and the boundary for future
coordination.

For the complete multi-device run, read
[Leave the Work PC Running](articles/keysync-dsh-multi-device-agent-workbench.md):
KeySync installs official DSH with Plugin Manager built in; the optional plugins
add the three conversation choices, Files, and Terminal, and another device
reopens the original session.
