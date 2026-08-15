# Product Specification

## Purpose

Relay is the waiting and external-event subsystem for an Agent product. An ordinary
conversation can delegate conditions that may become true much later. Relay observes
those conditions, finds relevant conversations, and reliably injects external events
back into their existing inboxes.

Relay does not own conversations, execute their tasks, or replace the Agent harness.
DeepSeek Harness (DSH) owns conversation creation, history, context, Agent execution,
and message ordering.

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

All new conversations are ordinary DSH conversations. User messages, including
messages sent while a Wait is active, go directly to DSH. The Agent decides during
that normal turn whether to keep, replace, or cancel its Waits.

Relay owns only:

- Wait and Monitor registration;
- durable external Event ingestion and semantic routing;
- reliable Event injection into an existing DSH inbox;
- inspection and management of Waits and Monitors.

The DSH inbox is the sole ordering boundary. A user message and Relay Event that
arrive close together are processed in admission order, like any two messages.

## Control Surfaces

Conversation history, continuing a conversation, and creating a conversation belong
to DSH on desktop or mobile. Relay supplies a separate automation-style view for
"what is being waited for": active Waits, Monitor health, next checks, recent
triggers, pause/resume, cancel, run-now, and a link to the owning conversation.

## Conversation Activity

A Relay Event resumes work through DSH's normal Agent lifecycle. DSH remains the
single authority for conversation activity and streams its ordinary status and
Session events to every connected client:

- when Event processing starts, the owning Session shows DSH's running indicator;
- opening that Session while it runs shows output as it is produced, without reload;
- another selected Session is not replaced or interrupted by the background activity;
- when an unselected Session finishes, DSH keeps its completion marker until opened.

Relay must not create a parallel execution-state model or require history reload to
observe an Event-triggered turn.

## Priorities

Missing a business event is more costly than extra model calls, latency, or an
unnecessary escalation. Routing therefore favors recall and may spend additional
tokens on ambiguous cases. Decisions are autonomous; no human approval sits inside
the routing loop, and model judgment is not claimed to be perfect.

Every accepted Event must remain traceable to an explicit disposition. Duplicate
provider delivery must not cause duplicate Relay injection.

## Initial Scope

The first complete slice covers normalized email Events, several concurrent DSH
conversations, several Waits per conversation, semantic routing without dependable
correlation IDs, repeated wait/event/wait cycles, local bound Monitors, retryable
delivery, and inspection records.

Production connector breadth, multi-tenant authorization, a visual workflow builder,
unrestricted generated Monitor code, and a standalone conversation dashboard are not
part of this slice.
