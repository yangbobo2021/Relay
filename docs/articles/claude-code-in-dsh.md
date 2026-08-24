# Give Analysis and Review to Claude Code: Session Continuity Inside DSH

English | [中文](claude-code-in-dsh.zh.md) | [Series index](dsh-agent-workbench-series.md)

An implementation often benefits more from a second agent's point of view than
from asking the first agent to inspect its own reasoning again. My usual reason
to open Claude Code is not to replace every DSH conversation. It is to get a
different path through a review, a design comparison, or a problem that has
become stuck in one framing.

The inconvenience is application switching. The project is in DSH, the
implementation may be in Codex, and the review opens in another Claude Code
window. I connected the Claude Agent SDK as another DSH conversation backend to
keep that work attached to the project.

![A real Claude Code conversation completed inside DSH](../media/dsh-claude-conversation-live.png)

## Not a fresh Claude request on every turn

The plugin binds one DSH Session to one Claude Agent SDK Session. The first turn
creates the Session; later turns resume its Session ID. Working directory,
model, reasoning effort, and permission choices follow that conversation.

This is different from rebuilding a prompt from visible chat history for every
request. Claude Code continues through its own Session mechanism. DSH keeps the
user-facing history and presents streamed answers, tool activity, approvals,
and questions in one interface.

The default backend is the Claude Agent SDK. A CLI fallback remains as a
development compatibility path, but the plugin refuses to pretend that DSH
tools exist when that fallback cannot expose them. A conversation that needs
DSH-contributed tools must use the SDK backend.

## Model selection has to follow the backend

An early integration bug was easy to miss: after switching to Claude Code, the
model menu could still retain choices from the previous conversation mode. That
is worse than a clear failure. The interface looks valid while the selection
does not belong to the active backend.

The current release reloads the models supplied by the Claude backend when the
mode changes, then synchronizes the default model and reasoning effort. After a
user chooses Claude Code, the visible choices are the Claude Sonnet, Opus, and
Haiku entries declared by that backend, not stale Codex or native DSH state.

That is the minimum contract of a shared interface: the controls live in one
place, but the agents do not lose their distinct capabilities.

## A natural review flow

I keep implementation and review in separate sessions instead of pretending
that two agents share one invisible context:

1. Finish the implementation and its test run in DSH or a Codex session.
2. Create a Claude Code session under the same project Workspace.
3. State the goal, changed scope, and risks that deserve attention.
4. Let Claude inspect the current working tree and return questions or findings.
5. After repairs, continue the same Claude Session for a second pass.

The handoff is still manual, but responsibility is legible. The Codex session
records how the change was implemented. The Claude session records why that
implementation was accepted or rejected. Those explicit inputs and outputs are
also what later coordination will need.

## Install it independently

The Claude plugin does not depend on Codex, Workbench, or Relay Events. The
commands below were validated against official DSH `0.1.1-rc.2`; `next` currently
resolves to `0.1.1-rc.2`, including the model-selection synchronization fix:

```bash
npx @deepseek-ai/dsh@0.1.1-rc.2 plugin --profile web add \
  relay-dsh-plugin-claude@next

npx @deepseek-ai/dsh@0.1.1-rc.2 web
```

Complete normal local Claude Code authentication before launch. Restart DSH,
add the project Workspace, create a Session, and choose **Claude Code** from the
mode menu. A successful installation needs no separate activation command.

- [GitHub repository](https://github.com/yangbobo2021/relay-dsh-plugin-claude)
- [npm package](https://www.npmjs.com/package/relay-dsh-plugin-claude)
- [Issue tracker](https://github.com/yangbobo2021/relay-dsh-plugin-claude/issues)

Putting Claude Code inside DSH is not an attempt to invent another Claude
interface. It gives the project a Claude-owned work record that can be resumed,
reviewed, and found next to its native DSH and Codex conversations.
