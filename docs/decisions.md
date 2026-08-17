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

## 2026-08-15: Codex Runs Inside Native DSH Sessions

Decision: Add Codex App Server as an execution backend inside DSH's native Web
conversation. The visible object is always a DSH Session. A Session created with the
Codex preset binds one Codex Thread, and Relay keys waiting state as
`codex:<thread-id>`.

Context: Treating Codex as one opaque tool loses streaming output, tool items,
generated images, approvals, and native multi-turn continuity. The App Server
protocol exposes those capabilities while retaining Codex ownership of model context
and execution.

Alternatives: Invoke Codex as an opaque DSH tool; build a separate Relay Codex Web
application; make Relay own a new transcript format.

Consequences: DSH remains the sole navigation and presentation shell. The DSH log is
an audit projection, while the persisted Codex Thread is the only model-context
source. Switching presets restores native DSH components. Codex Automation is not
used for Relay external Events.

## 2026-08-15: Claude Code Runs As A Relay Execution Backend

Decision: Add Claude Code as a second execution backend inside DSH's native Web
conversation. A Session created with the Claude Code preset binds one Claude Code
session, and Relay keys waiting state as `claude:<session-id>`.

Context: Claude Code CLI and Desktop share the Claude Code engine and configuration
ecosystem, but Desktop is a user surface rather than a stable Relay control protocol.
The Relay integration needs structured streaming, cancellation, lifecycle control and
activity projection.

Alternatives: Drive Claude Desktop with UI automation; invoke Claude as a stateless
Messages API model; copy Codex App Server assumptions into Claude-specific code.

Consequences: The canonical integration boundary is the Agent SDK runtime contract,
with Claude CLI retained as a subprocess fallback. SDK mode supports DSH-native
approval and user-question continuation through `canUseTool`; CLI fallback supports
structured output and cancellation but may fail closed on prompts. Claude Desktop
and Remote Control may be used for handoff or review, but not as Relay's primary
backend.
Normative behavior lives in the
[Claude Code In DSH Web Specification](spec/claude-code.md).
