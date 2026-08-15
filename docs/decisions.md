# Decisions

Record important architecture decisions here.

Use this format:

```text
Date:
Decision:
Context:
Alternatives:
Consequences:
```

## 2026-08-14: Autonomous Semantic Event Routing

Decision: Use recall-oriented semantic routing and autonomous disposition for the
first Relay scenario. Exact correlation fields remain optional evidence, and live
human review is not a fallback.

Context: Ordinary email replies may omit or corrupt thread identifiers, while
missing an inquiry can cost more than additional model calls or extra agent work.

Alternatives: Exact-key routing; low-confidence events waiting for manual review.

Consequences: Ingestion and disposition must be durable and inspectable. Ambiguous
actionable events are escalated without creating conversations, and model routing
errors remain an accepted product risk. Normative behavior lives in the
[Event Routing Specification](spec/event-routing.md).

## 2026-08-14: Session-Authored Bound Monitors

Decision: Generalize time triggers into durable condition Monitors. A Session may
generate a capability-limited observer and detector for a Wait. Bound Monitor Events
are delivered deterministically to their validated owner; shared Monitor Events use
semantic routing.

Context: Customer systems may be reachable only from a user's computer and may have
no supported push or query API. Requiring a person to repeatedly inspect a page
breaks long-running agent autonomy.

Alternatives: Support only provider integrations; expose the personal computer with
a public webhook tunnel; allow arbitrary agent-generated background scripts.

Consequences: Relay needs durable scheduling, observations, change detection,
artifact versioning, capability brokering, and a real sandbox boundary. A local
computer cannot recover transitions that the source neither retains nor exposes.
Normative behavior lives in the
[Trigger Monitoring Specification](spec/trigger-monitoring.md).

## 2026-08-14: DSH Owns Conversations And Ordering

Decision: All conversations and user messages belong to DSH. Relay stores Waits and
injects external Events through DSH's shared inbox; it does not create, run, complete,
or independently resume conversations.

Context: A conversation begins normally and only delegates a Wait when its Agent
needs an external result. User input may arrive while that Wait exists and must behave
like ordinary concurrent input rather than a special Relay wake command.

Alternatives: Relay-owned task Sessions and Runs; routing user messages through Relay;
separate Agent handles for Relay wakeups.

Consequences: DSH's shared resolver and inbox are the sole concurrency boundary.
Relay Activation means a retryable Delivery batch, and Wait management is a separate
automation-style surface linked to DSH conversations.
