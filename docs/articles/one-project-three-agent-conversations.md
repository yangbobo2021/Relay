# One Project, Three AI Conversations: Why I Put DSH, Codex, and Claude Together

English | [中文](one-project-three-agent-conversations.zh.md) | [Series index](dsh-agent-workbench-series.md)

I did not bring Codex and Claude Code into DeepSeek Harness because either tool
was disappointing. I did it because each is useful, and I no longer wanted my
day to be organized around their separate applications.

A normal task can start as a requirements discussion in DSH, move to Codex when
the change becomes implementation-heavy, then end in Claude Code for an
independent review. Files and a terminal sit in two more windows. A few hours
later, the hard part is often not the code. It is remembering which window owns
the conclusion that matters.

I wanted to invert that arrangement: keep the project in place and choose the
tool for the task.

![Codex, Claude Code, Files, and Terminal running in DSH](../media/dsh-plugin-suite-demo.gif)

## DSH is the front door, not the only answer

Native DSH conversations remain useful. Routine questions, short jobs, and work
already handled well by the installed DSH stack do not need another agent. When
a task reaches a capability limit, however, leaving the project workspace and
rebuilding context in another application is a poor handoff.

With the plugins installed, a new DSH session can use the native mode, Codex, or
Claude Code. DSH still owns the session, workspace, and interface. A Codex
session is driven by a Codex App Server Thread; a Claude session is driven by
the Claude Agent SDK. These are not generic API replies wearing different
labels. Each backend keeps its own execution model and conversation continuity.

The useful change is not merely two extra menu entries. Sessions still belong
to a project. Requirements, implementation, review, and verification for one
repository can live under one Workspace group instead of being recalled by
application.

## Cost and quality are not a binary choice

"Which agent is strongest?" is rarely the question I need to answer during a
working day. The practical question is which backend this task deserves.

- A routine question that should take ten minutes can begin in native DSH.
- A change that requires repeated file edits, commands, and test repair can use
  a Codex session.
- An independent review, a second design angle, or a difficult analysis can use
  a Claude Code session.

This is not a permanent division of labor or a model leaderboard. Subscription
terms, model versions, task shape, and team habits all affect cost and quality.
One entry point preserves the choice: inexpensive work does not need the most
expensive route, and important work does not have to accept a weaker result to
save a small amount.

## What works today

The published plugins currently provide:

- Codex and Claude Code choices in DSH's new-session mode menu;
- continued Codex Threads and Claude Sessions across their respective DSH turns;
- DSH input, history, approvals, and tool presentation;
- a Workbench host for the Files side view and Terminal bottom view;
- a project working directory attached to the session.

The Codex and Claude plugins install independently and do not require Relay
Events:

- [relay-dsh-plugin-codex](https://github.com/yangbobo2021/relay-dsh-plugin-codex)
- [relay-dsh-plugin-claude](https://github.com/yangbobo2021/relay-dsh-plugin-claude)
- [All Relay DSH plugins](https://github.com/yangbobo2021/Relay/blob/codex/relay-foundation/docs/dsh-plugins.md)

## What has not happened yet

The user still decides which agent should take a task and creates the sessions
separately. The system does not yet compress a DSH conversation and hand it to
Codex automatically. It does not ask Claude to review a Codex implementation
when the implementation finishes. A shared interface is not the same thing as
multi-agent orchestration.

What has changed is the boundary. Projects, user-facing sessions, and execution
backends are no longer one inseparable choice. That is a prerequisite for later
coordination: a task can belong to a project, an agent can be selected, and a
future Relay event or handoff has a clear destination.

I prefer to treat the current release as a useful project workbench, not a grand
multi-agent diagram. Today it reduces application switching, organizes sessions,
and lets cost and quality guide backend choice. Automated coordination can earn
its place after a real end-to-end loop exists.

The next article opens the Codex plugin: who starts App Server, how one DSH
session binds to a Thread, and why the integration is not simply a shell call to
`codex`.
