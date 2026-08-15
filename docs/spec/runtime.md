# Runtime Specification

## Ownership

DSH Session is the only conversation identity and the authority for transcript,
execution state, context, and inbox ordering. Relay stores a waiting projection keyed
by that existing Session ID. The projection is not a second Session and does not say
whether the DSH Agent is running, idle, or cold.

Relay never creates a conversation in response to a user message or external Event.
It never intercepts ordinary user input and never acquires an execution lease over a
DSH conversation.

## Records

`Wait` is a compact, phase-specific description of an external Event the Agent wants
Relay to recognize. A conversation may expose several active Waits.

`Monitor` is a durable observer bound to a Wait. It produces an Event when a source
condition changes.

`Event` is normalized external input durably accepted by Relay.

`Delivery` assigns one Event to one existing DSH Session and records matched Waits.

`Activation` is one stable Delivery batch for one DSH Session. Its identity and
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
4. Relay creates or reuses a stable Activation and calls the shared DSH inbox adapter.
5. The adapter resolves the existing Session through DSH's shared resolver and admits
   the message into that Session's normal inbox.
6. After the adapter's durable acceptance boundary, Relay commits the Activation,
   resolves Deliveries, and consumes matched Waits.
7. The Agent processes the message in normal inbox order and may register its next
   Waits.

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

- User messages bypass Relay and enter DSH directly.
- Relay Events and user messages share one DSH inbox and therefore one order.
- One expected exclusive reply cannot have multiple known live owners.
- A non-exclusive Event may target several conversations.
- An Event cannot be resolved before all required Deliveries are accepted.
- Retry reuses Event, Delivery, and Activation identities.
- Consuming one Wait does not complete or terminate its DSH conversation.
- Relay never infers DSH conversation completion from the absence of Waits.
- A bound one-shot Monitor ends with its Wait; a recurring Monitor pauses after a
  trigger until the Agent explicitly rearms it.
- Every accepted Event has an inspectable decision and terminal disposition.

## Minimum Contract

The harness-neutral runtime exposes conceptual operations equivalent to:

```text
registerWaits(dshSessionId, taskSummary, waits, monitors?, monitorRearms?)
cancelWaits(dshSessionId)
listWaits()
ingestAndRoute(event)
dispatchSession(dshSessionId)
inbox.deliver(dshSessionId, activationId, deliveries)
```

No operation creates, resumes, disposes, or serializes a DSH Agent independently of
the harness's shared resolver and inbox.
