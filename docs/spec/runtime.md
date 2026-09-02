# Runtime Specification

## Ownership

The DSH Session is the only user-facing conversation identity. DSH owns navigation,
input, title, and presentation history. Its selected execution backend owns model
context and execution ordering. A Codex-backed Session binds exactly one Codex Thread.
Relay stores a waiting projection keyed by `<runtime>:<backend-id>`; it is not a
second conversation or execution-state authority.

Relay never creates a conversation in response to a user message or external Event.
The DSH Web UI may create a Session with a selected Agent preset. Relay never creates
a Session in response to an Event and never acquires an execution lease over it.

## Records

`Wait` is a compact, phase-specific description of an external Event the Agent wants
Relay to recognize. A conversation may expose several active Waits. A Wait may contain
versioned Agent-authored continuation describing the next action, success condition,
constraints, artifacts, failure handling, and timeout handling. Relay never derives
that continuation from external Event content or a routing model.

`Monitor` is a durable observer bound to a Wait. It produces an Event when a source
condition changes.

`Event` is normalized external input durably accepted by Relay.

`Delivery` assigns one Event to one existing conversation backend and records immutable
matched-Wait snapshots and routing evidence; the owning DSH Session remains its
presentation target.

`Activation` is one stable Delivery batch for one backend-bound DSH Session. Its identity and
Delivery set survive retries. It is a Relay delivery record, not an Agent run.

## Agent Operations

During any ordinary conversation turn, the Agent may:

- register a replacement set of Waits and optional Monitors;
- rearm a recurring Monitor against a replacement Wait;
- cancel all current Waits; or
- do nothing, leaving current Waits unchanged.

Registration is atomic: previous live Waits are superseded and the new set becomes
active together. Monitor baseline validation completes before its Wait and Monitor
are committed. A registration failure leaves the previous set unchanged.

## Event Flow

1. A connector or Monitor durably ingests an Event.
2. Semantic routing commits `deliver`, `escalate`, or `dismiss`.
3. `deliver` creates durable Deliveries and claims matched Waits.
4. Relay creates or reuses a stable Activation and calls the Session's execution-backend
   adapter.
5. The adapter resolves the existing native Session and admits the message at that
   backend's normal acceptance boundary.
6. After the adapter's durable acceptance boundary, Relay commits the Activation,
   resolves Deliveries, and consumes matched Waits.
7. The Agent processes the message in normal inbox order and may register its next
   Waits.

The injected envelope includes the exact matched Wait version and continuation that
were validated during step 3. Replacing a Wait after routing cannot rewrite an already
committed Delivery envelope.

Failure before step 6 leaves the same Activation and Deliveries retryable. The
Activation ID is included in the injected envelope for reconciliation and tool-side
idempotency.

## Lifecycles

```text
Wait:       active -> claimed -> consumed
                  -> superseded | cancelled

Event:      received -> routing -> dispatched -> resolved
                                -> escalated  -> resolved
                                -> dismissed  -> resolved

Activation: active -> committed
```

`claimed` prevents a second claim of the same exclusive Wait while delivery is in
progress. It does not mean the DSH conversation is running. A later conversation
turn may replace or cancel a claimed Wait; an already admitted Event remains an
ordinary queued message.

## Invariants

- User messages bypass Relay routing and enter their conversation backend directly.
- Relay Events and user messages share the owning backend's admission path.
- One expected exclusive reply cannot have multiple known live owners.
- A trusted binding is accepted only through a registered source capability. Caller
  fields in generic Event JSON cannot assert Session or Wait ownership.
- Conflicting cross-Session exclusive exact matches escalate instead of selecting by
  storage or iteration order.
- A non-exclusive Event may target several conversations.
- An Event cannot be resolved before all required Deliveries are accepted.
- Retry reuses Event, Delivery, and Activation identities.
- Consuming one Wait does not complete or terminate its DSH Session or Codex Thread.
- Relay never infers DSH conversation completion from the absence of Waits.
- A bound one-shot Monitor ends with its Wait; a recurring Monitor pauses after a
  trigger until the Agent explicitly rearms it.
- Every accepted Event has an inspectable decision and terminal disposition.

## Minimum Contract

The harness-neutral runtime exposes conceptual operations equivalent to:

```text
registerWaits(runtimeSessionId, taskSummary, waits, monitors?, monitorRearms?)
cancelWaits(runtimeSessionId)
listWaits()
ingestAndRoute(event)
dispatchSession(dshSessionId)
inbox.deliver(runtimeSessionId, activationId, deliveries)
```

No Relay Event operation creates, disposes, or serializes an Agent independently of
the selected backend adapter.
