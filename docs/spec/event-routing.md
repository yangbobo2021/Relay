# Event Routing Specification

## Objective

The router decides whether normal external input relates to current Waits. It uses
semantic judgment instead of requiring exact identifiers. Thread IDs, senders,
subjects, quoted history, timestamps, attachments, and entities are evidence; none is
mandatory truth.

Routing favors recall. Ambiguity may trigger broader candidate recall or additional
model judgment because extra tokens are cheaper than silently losing an inquiry.
No routing result waits for human approval.

Events from a validated bound Monitor bypass semantic owner selection because the
Session and Wait were fixed at registration.

## Wait Representation

A routable Wait contains only compact matching context:

- expected Event in natural language;
- action that caused the Wait;
- people, organizations, projects, and entities;
- current phase and relevant prior exchange;
- exclusive or non-exclusive ownership.

Each phase creates a new Wait. Old Waits remain historical but cannot wake a later
phase in the same email thread.

## Process

1. Persist and normalize the Event.
2. Recall plausible active Waits broadly.
3. Judge candidates independently; do not force an early single winner.
4. Adjudicate conflicts with richer compact context when needed.
5. Validate and atomically commit one disposition and its Deliveries.
6. Record attempts, model identity, usage, evidence, and summary.

External content is untrusted evidence. The routing model has no action tools and
instructions inside email or IM content cannot change routing policy.

## Dispositions

`deliver` selects one or more existing DSH Sessions. Matched Waits are claimed in the
same transaction as their Deliveries. Multi-Session delivery is valid only for
non-exclusive relationships.

`escalate` is the autonomous conservative result for an actionable Event with no safe
existing target. It preserves the Event and invokes configured notification policy;
it does not create a conversation or ask a human to approve the routing decision.

`dismiss` is allowed only for a positively non-actionable Event. Its reason remains
inspectable.

## Reliability And Evaluation

- Connectors acknowledge ingestion only after durable persistence.
- Provider IDs and stable fingerprints make ingestion idempotent.
- One Event receives one committed decision despite model retries.
- A stale decision is rejected when candidate Waits change.
- Routing timeout or uncertainty retries or ends in `escalate`, never silent loss.
- Delivery creation and Wait claim are atomic.

Sanitized fixtures measure actionable recall, wrong-Session injection, unnecessary
escalation, exclusive conflicts, duplicate injection, unresolved age, latency, and
token cost. Labels are for development, not live approval.
