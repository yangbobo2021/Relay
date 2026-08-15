# Product Specification

## Purpose

Relay is the waiting and external-event subsystem for an Agent product. An ordinary
conversation can delegate conditions that may become true much later. Relay observes
those conditions, finds relevant conversations, and reliably injects external events
back into their existing inboxes.

Relay does not own conversation transcripts, execute tasks independently, or replace
the Agent harness. DeepSeek Harness (DSH) owns every visible Session and its native
Web experience. A Session may use DSH's Agent path or bind one Codex Thread; Codex
then owns model context and execution for that Session.

## First Users And Scenario

The first users operate coding or support Agents that send ordinary email and wait
for replies. Several conversations may wait for different replies, one conversation
may wait for several events, and one email thread may contain several task phases.

When an email arrives, Relay compares its meaning with current Waits and either:

- delivers it to each relevant existing DSH conversation;
- escalates an actionable unmatched event through configured notification policy;
- or dismisses a positively non-actionable event.

The Agent handles the injected message normally and may then register replacement
Waits. Email must work without magic text, special links, or reliable thread IDs.

## Product Boundary

Conversation creation uses DSH's native new-Session menu and may select an execution
preset such as Codex. User messages, including messages sent while a Wait is active,
enter through DSH and continue through that Session's execution backend. The Agent
decides during the normal turn whether to keep, replace, or cancel its Waits.

Relay owns only:

- Wait and Monitor registration;
- durable external Event ingestion and semantic routing;
- reliable Event injection through the owning backend adapter;
- inspection and management of Waits and Monitors.

The owning backend's admission path is the ordering boundary. A user message and
Relay Event that arrive close together are processed according to that backend's
native ordering rules.

## Control Surfaces

Conversation creation, navigation, input, and presentation belong to DSH Web. Relay
may project backend events into DSH's native slots without creating a second chat
application. Relay also supplies an automation-style view for
"what is being waited for": active Waits, Monitor health, next checks, recent
triggers, pause/resume, cancel, run-now, and a link to the owning conversation.

## Conversation Activity

A Relay Event resumes work through the Session's execution backend. DSH remains the
visible activity surface and projects backend state to connected clients:

- when Event processing starts, the owning Session shows the backend running state;
- opening that Session while it runs shows output as it is produced, without reload;
- another selected Session is not replaced or interrupted by the background activity;
- when an unselected Session finishes, its completion remains visible until opened.

Relay must not create a parallel execution-state authority or require a full-page
reload to observe an Event-triggered turn.

## Priorities

Missing a business event is more costly than extra model calls, latency, or an
unnecessary escalation. Routing therefore favors recall and may spend additional
tokens on ambiguous cases. Decisions are autonomous; no human approval sits inside
the routing loop, and model judgment is not claimed to be perfect.

Every accepted Event must remain traceable to an explicit disposition. Duplicate
provider delivery must not cause duplicate Relay injection.

## Initial Scope

The first complete slice covers normalized email Events, several concurrent DSH
Sessions, several Waits per conversation, semantic routing without dependable
correlation IDs, repeated wait/event/wait cycles, local bound Monitors, retryable
delivery, inspection records, and Codex App Server inside native DSH Web Sessions.

Production connector breadth, multi-tenant authorization, a visual workflow builder,
unrestricted generated Monitor code, and a standalone conversation dashboard are not
part of this slice.
