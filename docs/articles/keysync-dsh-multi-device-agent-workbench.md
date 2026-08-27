# Leave the Work PC Running: One Remote Workbench for DSH, Codex, and Claude

English | [中文](keysync-dsh-multi-device-agent-workbench.zh.md)

In an earlier KeySync demo, we filmed an intentionally ridiculous opening:
someone cycling home while a laptop was still running an agent in the bike
basket. Please do not copy that. The problem behind the shot is real, though:
what happens to an active task after you leave your desk?

I do not want a fresh chat box on my phone. I want the same project, the same
session, and a place to continue.

![The same DSH task recorded on Mac, Windows, and a phone](../media/keysync-dsh-agent-workbench/01-three-device-handoff.png)

_A composite made from the real three-device recording: the task runs on the
Mac, is checked from a phone, and is continued from Windows. This earlier test
used a native DSH conversation. Codex and Claude Code use the same DSH entry
point described below, but keep separate sessions._

## Why remote DSH alone was not enough

I do not use one agent for every job.

My current habit is simple. I start ordinary questions in native DSH. I use
Codex when a task needs sustained code reading, shell commands, and file
changes. I often use Claude Code for a second view on a document, design, or
review. That is not a model ranking. It is a practical choice based on the task,
price, and result I need.

The awkward part is everything around the answer. Conversations end up scattered
across separate apps. Once I leave the work computer, each tool also needs its
own way back in.

The setup I now use has three parts:

- **KeySync** installs and runs official DeepSeek Harness (DSH) on the work
  computer, then provides a remote entry to that computer's DSH Web UI.
- The **Codex and Claude plugins** add two optional conversation backends to
  DSH.
- The **Workbench, Files, and Terminal plugins** keep the project files and
  shell next to the conversation.

KeySync's one-click DSH setup includes Relay Plugin Manager so plugins can be
managed from Chat. The other Relay plugins are optional and are added through
DSH's own plugin system as needed.

## First, install official DSH

DeepSeek Harness has its own one-click install entry under KeySync's Devices and
Apps page.

![The DeepSeek Harness install action in KeySync](../media/keysync-dsh-agent-workbench/02-keysync-install-dsh.jpg)

_Real KeySync screen on macOS, ready to install DeepSeek Harness. This is the
official DSH package, not a Relay-maintained fork._

After DSH is running, install the conversation plugins you need. Restart DSH,
open New Session, and the mode menu keeps Standard mode while adding Codex and
Claude Code.

![Standard mode, Codex, and Claude Code in official DSH](../media/keysync-dsh-agent-workbench/03-dsh-backend-menu.jpg)

_Real mode menu from official DSH `0.1.1-rc.2` with both conversation plugins
installed. Installing only one plugin adds only that backend._

## Three agents together, without mixing their context

For the recording, I created three sessions under one workspace. Codex checked a
code boundary. Claude Code reviewed a remote-handoff document. Native DSH
analyzed test results.

![A real Codex App Server conversation inside DSH](../media/keysync-dsh-agent-workbench/04-codex-conversation.jpg)

_Codex session recording: its tool call, reasoning, and answer stay visible in
this DSH session._

![A real Claude Agent SDK conversation inside DSH](../media/keysync-dsh-agent-workbench/05-claude-conversation.jpg)

_Claude Code session recording: it reads a document and returns two review
findings in its own session._

The three sessions can sit next to each other under the same project, but they
do not automatically share context. To continue one, open that original session.
What is unified is the project entry and session management, not the agents'
memory.

## The project is next to the conversation

Collecting chats is only half the job. When an agent mentions a file, I want to
inspect it immediately. When I need to verify a command, I do not want to hunt
for another terminal window.

Files shows the current workspace tree and text preview on the right. Terminal
opens a real shell at the bottom. Workbench is only the shared panel host; it
does not read files or start commands itself.

![The Files panel previewing a real workspace file](../media/keysync-dsh-agent-workbench/06-files-panel.png)

_Official DSH running the Files plugin and previewing the Relay workspace's
`README.md`._

![The Terminal panel running a real command](../media/keysync-dsh-agent-workbench/07-terminal-panel.png)

_Official DSH running `echo` in the current workspace. The screenshot keeps the
real environment's zsh history permission warning instead of replacing the
output with a mock._

Terminal is provider-neutral and needs another plugin to supply the actual
shell. In this combination, the Codex plugin provides that shell backend. Files
does not depend on Codex or Claude.

## Change devices, keep the original session

After leaving the work computer, I can open its DSH instance from another
KeySync desktop client or from the KeySync web page on a phone, tablet, or
computer.

The important step is to open the existing session, not create a new one. Reopen
the Codex session and a follow-up can depend on the earlier code review. The
same rule applies to Claude Code and native DSH sessions.

![Continuing the original Codex session from the remote web entry](../media/keysync-dsh-agent-workbench/08-codex-remote.png)

_Real remote recording: the browser reopens the original Codex session with the
same workspace and session list. The outer frame and heading were added only to
identify the recording context._

Three boundaries matter here:

1. The project, shell, and agents still run on the work computer. They are not
   moved to the phone or to a cloud runtime.
2. The work computer must remain online and awake enough to keep the programs
   running. KeySync and DSH must also stay active.
3. This opens the designated DSH Web UI; it is not general remote control of the
   computer. Use it only where the device owner and organization permit it.

## Installation

The current public validation baseline is official DSH `0.1.1-rc.2`. This
command installs both conversation backends, the file panel, and the terminal
panel:

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-codex@next \
  relay-dsh-plugin-claude@next \
  relay-dsh-plugin-workbench@latest \
  relay-dsh-plugin-files@latest \
  relay-dsh-plugin-terminal@latest
```

Codex and Claude Code can each be installed on their own. They are standalone
npm packages, do not depend on Relay Events, and do not require a Relay
checkout. Workbench is needed only by panel plugins such as Files and Terminal.

Restart DSH after installation. Codex and Claude Code still require their normal
account authentication on the work computer.

As of August 26, 2026, the Codex `next` tag points to `0.1.1-rc.4`, Claude
`next` points to `0.1.1-rc.2`, and the `latest` tag for Workbench, Files, and
Terminal points to `0.1.0`. Check the npm pages before installation because
these tags will move.

## What this is, and what it is not

This setup already handles four ordinary problems: I no longer search several
interfaces for a project's conversations; DSH, Codex, and Claude sessions can be
grouped by project; files and a shell remain beside the conversation; and I can
return to the original session after leaving my desk.

It is not automatic multi-agent orchestration. I still decide which agent gets
each task. Clear project, session, and backend boundaries give future handoffs a
sensible foundation, but I do not want to market unfinished coordination as a
current feature.

The useful change is much less grand: I can still choose a tool for cost,
quality, and task fit without changing the entire place where I work.

## Links

- [Download KeySync](https://sublang.ai/keysync/download/)
- [Official DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [Relay and the complete DSH plugin list](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.md)
- [Codex plugin](https://github.com/yangbobo2021/relay-dsh-plugin-codex) ·
  [Claude Code plugin](https://github.com/yangbobo2021/relay-dsh-plugin-claude)
- [Workbench](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) ·
  [Files](https://github.com/yangbobo2021/relay-dsh-plugin-files) ·
  [Terminal](https://github.com/yangbobo2021/relay-dsh-plugin-terminal)
- [Chinese video: installing DSH with KeySync and handing off across three devices](https://www.bilibili.com/video/BV1pthK6TEa9/)
- [Chinese video: adding Codex and Claude Code to DSH](https://www.bilibili.com/video/BV1t2h36bE9H/)
- [Chinese beginner tutorial: from installation to remote continuation](https://merico.feishu.cn/docx/HiSKd8V9qopI19x55aSchW8onHe)
