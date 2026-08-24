# From Choosing Agents to Coordinating Them: Relay's Next Step

English | [中文](from-agent-choice-to-coordination.zh.md) | [Series index](dsh-agent-workbench-series.md)

Today I can open a project in DSH and create a native, Codex, or Claude Code
session. I choose Codex for implementation, Claude for a second opinion, and
native DSH for routine work. That already removes application switching and
puts the sessions back under their project.

The workflow still depends on one exceptionally busy coordinator: the human.

The human chooses the agent, extracts the conclusion from the previous session,
watches for implementation to finish, and carries the result into review.
Putting three agents in one interface creates a shared entry point. Without task
state, a handoff contract, and events, it is not multi-agent coordination.

![The working DSH plugin workbench available today](../media/dsh-plugin-suite-demo.gif)

## The foundation that exists today

The current pieces are concrete:

- DSH organizes user-facing Sessions by Workspace;
- every Session binds explicitly to native DSH, a Codex Thread, or a Claude Session;
- Files and Terminal resolve the active Session's project directory;
- Codex, Claude, and Workbench plugins compose through public capability boundaries;
- the Relay repository contains tested runtime pieces for Waits, Monitors, Events,
  routing, and Delivery.

The last item needs careful wording. Relay's event core is still being built. It
is not yet a finished coordinator that ordinary users can install for automatic
cross-agent workflows. The five published DSH plugins do not require Relay
Events.

## A handoff cannot be a copied transcript

Suppose Codex finishes an implementation and Claude is asked to review it. The
easiest handoff is to paste the entire Codex conversation into a Claude prompt.
That is expensive, noisy, and unclear about responsibility.

A dependable handoff should be a structured task result containing:

- the objective and acceptance criteria;
- project and working directory;
- changed files and important decisions;
- tests run and known failures;
- questions the next agent must answer;
- artifacts, permissions, and remaining budget.

The full conversation can remain available for audit, but the next agent should
receive work facts first, not an unedited transcript. Context compression here
is not a trick for making a model forget more elegantly. It is how a reliable
handoff is produced.

## One loop worth building

The next milestone should be a small complete flow:

1. A user defines a task and acceptance criteria in a project's DSH Session.
2. User choice or an explicit policy assigns implementation to Codex.
3. Codex finishes with a structured result and an `implementation.completed` Event.
4. Relay delivers the event to that project's Claude review Session.
5. Claude returns findings. Blocking findings become a repair task; otherwise
   the workflow waits for user confirmation.
6. Every state returns to the project, where the user can inspect why each
   handoff happened and what it contained.

This does not attempt to make ten agents hold an autonomous meeting. It tests
three harder facts: whether a task reaches the correct Session, whether a result
continues with bounded context, and whether failure remains visible and
recoverable.

## Cost and quality should become policy

Coordination should not send every step to the most expensive model by default.
A first policy can be simple:

- routine work remains on the native DSH backend;
- repository execution moves to Codex;
- Claude review runs for high-risk changes or an explicit user request;
- the workflow stops for the user when budget, permission, or confidence is insufficient.

Those rules must be visible, editable, and overridable. The system may recommend
a backend, but the user should know why it was chosen and be able to select
another agent.

## What is not implemented yet

Automatic backend routing, structured cross-agent context handoff, a durable
task graph, retry policy, and a complete coordination status interface are not
implemented yet. Relay's Wait, Monitor, and Event pieces also need real user
workflows before they can be delivered as a stable product.

This article is therefore not a feature announcement. It is an implementation
boundary: first make one Codex implementation, Claude review, and user approval
loop dependable; only then add more agents and external events.

The code and current progress live in
[Relay](https://github.com/yangbobo2021/Relay). The five usable DSH plugins remain
independently published. Following Relay shows how they can move from selectable
backends to coordinated project work.
