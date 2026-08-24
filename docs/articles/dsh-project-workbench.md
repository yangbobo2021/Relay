# More Than Chat: Files and Terminal Turn DSH into a Project Workbench

English | [中文](dsh-project-workbench.zh.md) | [Series index](dsh-agent-workbench-series.md)

Connecting Codex and Claude Code to DSH solves the conversation entry point.
Once real project work begins, I still have two plain questions: which directory
is the agent looking at, and can I open a file immediately after it says the
file changed?

If the answer is still "find another editor and terminal," a shared conversation
interface has only finished half the job.

DSH already has Workspaces and Sessions grouped by project. The Workbench,
Files, and Terminal plugins use that existing boundary to place the active
Session's project environment beside the conversation.

![The Files view showing the real Relay workspace](../media/dsh-plugin-suite-live.png)

## Workbench only makes room

Workbench is a shared shell. It does not read files or launch a shell process.
It publishes contracts for side and bottom views, then owns the layout, opening,
and closing of those regions.

The extra package prevents a worse arrangement. If Files patched the DSH layout
and Terminal patched it again, every future side view would have to understand
the others. A feature plugin now declares that it belongs in `side` or `bottom`
without importing another feature's implementation.

Installing Workbench alone does not display an empty panel. A surface appears
only after Files or Terminal registers content for it.

## Files follows the active Session directory

Files shows the current Session Workspace as a tree in the side view. It can
expand directories, filter entries, and preview text. The Session path reaches
a Host-side file capability; the browser is not given arbitrary access to the
local file system.

It is currently a viewer, not a full editor. Binary files, content outside its
preview limits, and saving edits still belong in the appropriate tool. That
constraint makes its job clear: when an agent mentions a file, the user can
inspect the current content without leaving the conversation.

## Terminal needs a real provider

The Terminal plugin owns the bottom xterm view, input/output handling, resize,
and Session attachment. It does not hard-code a shell backend. A provider that
implements the public terminal capability owns the real process.

In the currently published set, the Codex plugin can provide that capability.
With Workbench, Terminal, and Codex installed, the terminal starts a real shell
in the active project directory. Input, output, and resize travel through the
backend; the page is not simulating command results.

![A real command running in the Relay workspace Terminal](../media/dsh-terminal-command-live.png)

If Terminal is installed without a provider, the panel says that interactive
terminal capability is missing. It does not silently fall back to a fake shell.

## Why project organization beats a chat list

One project can hold several kinds of Session:

- native DSH sessions for requirements, short work, and routine discussion;
- Codex sessions for implementation history;
- Claude Code sessions for review and a second opinion.

They share project ownership, not model context. Files and Terminal resolve the
active Session Workspace, so the visible project environment follows when the
user changes sessions. That model is easier to understand and audit than an
invisible memory supposedly shared by every agent.

## Install the project workbench

The three UI plugins are currently stable at `0.1.0`. Add the Codex candidate
when the Terminal should use Codex for a real shell provider:

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest \
  relay-dsh-plugin-codex@next

npx @deepseek-ai/dsh@0.1.1-rc.2 web
```

- [Workbench repository](https://github.com/yangbobo2021/relay-dsh-plugin-workbench)
- [Files repository](https://github.com/yangbobo2021/relay-dsh-plugin-files)
- [Terminal repository](https://github.com/yangbobo2021/relay-dsh-plugin-terminal)

I am not trying to turn DSH into another heavyweight IDE. For agent work, simply
putting the project, conversations, file evidence, and execution site in one
traceable place already removes a great deal of pointless window switching.
