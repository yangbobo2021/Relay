# No Fork Required: Add Codex, Claude Code, Files, and Terminal to DeepSeek Harness

English | [中文](no-fork-dsh-plugins.zh.md)

DeepSeek Harness is useful as a conversation surface, but extending that
surface can create an expensive maintenance choice: patch DSH core and keep
rebasing, or keep switching between separate agent and developer tools.

There is now a third path. Five independently installable plugins add Codex,
Claude Code, workspace files, and a terminal to official DSH. They use DSH's
plugin system, so you can update DSH without carrying a fork.

![Codex, Claude Code, Files, and Terminal running as DSH plugins](../media/dsh-plugin-suite-demo.gif)

The recording is an actual npm installation on official DSH, not a mockup:
[open the H.264 MP4](../media/dsh-plugin-suite-demo.mp4?raw=1) or review the
[acceptance evidence](../acceptance/dsh-plugin-demo-qa.md).

This walkthrough is for DSH users who want another conversation backend or a
more complete coding workspace. It is not a Relay Events tutorial: the five
plugins work without Relay's event runtime.

## What Changes After Installation?

Install the Codex plugin and **Codex** appears in DSH's New Session mode menu.
The session is backed by a Codex App Server Thread while DSH keeps its native
conversation, composer, approval, question, and tool presentation.

Install the Claude plugin and **Claude Code** appears beside it. That backend
uses the Claude Agent SDK and continues the same Claude session across DSH
turns.

Install Workbench with Files and DSH gains a right-side workspace tree and text
preview. Install Workbench with Terminal and DSH gains a bottom xterm surface.
The terminal presentation is provider-neutral; the Codex plugin is the currently
published provider in this suite.

These are separate capabilities. A user who only wants Codex does not need
Claude, Workbench, Files, Terminal, or Relay Events.

## Why the Boundary Matters

The two conversation backends are independent plugins. Workbench owns only the
public side/bottom view contracts. Files and Terminal use those contracts
instead of importing each other's implementation. Terminal accepts providers
through a public registry rather than calling Codex code directly.

That separation has two practical consequences:

1. Official DSH remains an immutable dependency instead of a customized codebase.
2. Each plugin can be versioned, tested, installed, and eventually moved to a
   different repository without dragging the rest of Relay with it.

Relay is the maintainer and compatibility workspace for the suite. Relay Events
remains optional and has a different job: durable waits, monitors, external
events, routing, and delivery into the correct DSH session.

## Install the npm Packages

The commands below were validated against official DeepSeek Harness
`0.1.1-rc.2` at commit
[`b150a551`](https://github.com/deepseek-ai/deepseek-harness/commit/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e).
Node.js 22.13 or newer and `pnpm` on `PATH` are required.

Stop a running DSH Web process, then install the combination you need.

Codex only:

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@next
```

Claude Code only:

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-claude@next
```

Files and Terminal, with Codex providing the live terminal:

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest \
  relay-dsh-plugin-codex@next
```

The backend release candidates are recommended during the current DSH preview:
Codex `next` contains the bundled cross-platform App Server runtime, and Claude
`next` contains the current model-selection synchronization fix. Check each npm
page before pinning a production version.

Start DSH Web again:

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 web
```

Codex and Claude still require their normal local authentication. The plugins
do not collect credentials. Workbench itself is intentionally invisible until
a view plugin registers a panel.

## Install a GitHub Development Build

You can test an unreleased commit directly from GitHub:

```bash
pnpm dlx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  github:yangbobo2021/relay-dsh-plugin-codex#main \
  github:yangbobo2021/relay-dsh-plugin-claude#main \
  github:yangbobo2021/relay-dsh-plugin-workbench#main \
  github:yangbobo2021/relay-dsh-plugin-files#main \
  github:yangbobo2021/relay-dsh-plugin-terminal#main
```

Use a tag or full commit SHA instead of `#main` when you need reproducible
installs. GitHub packages must be listed explicitly because DSH's pnpm profile
does not accept a GitHub package hidden as a transitive dependency.

## Verify Before Starting Work

Open a new session and check the visible behavior:

- the mode menu contains only the backends you installed;
- Files appears after selecting a workspace and can preview a text file;
- Terminal appears in the bottom Workbench panel;
- a live terminal reports its provider clearly instead of silently falling back.

You can inspect package composition from the CLI as well:

```bash
dsh plugin --profile web why relay-dsh-plugin-codex
dsh plugin --profile web why relay-dsh-plugin-files
dsh plugin --profile web why relay-dsh-plugin-terminal
```

Each repository runs CI against an official DSH checkout. Tagged releases use
the repository's npm release workflow; current Codex and Claude candidates
publish SLSA provenance, and the Workbench-side repositories are configured to
do the same on their next tagged release.

## Who Does Not Need This?

If standard DSH agents and the existing conversation UI already cover your
workflow, install nothing. If you only need a command prompt outside the
conversation, a normal terminal is simpler. If your actual problem is waking a
long-running session from email, a webhook, or a monitored condition, that is
Relay Events territory rather than a reason to install every UI plugin.

Start with one capability. The
[Relay DSH plugin catalog](../dsh-plugins.md) links every repository, npm package,
dependency rule, and troubleshooting guide. Issues and compatibility reports are
welcome in the relevant plugin repository.
