# DeepSeek Harness Plugin Integration Assessment

## Reference

- Repository: `https://github.com/deepseek-ai/deepseek-harness`
- Commit: `47f943859bef60e4160492346772ded9b24f765a`
- Package: `0.1.0-rc.5`
- Reviewed: 2026-08-14

DSH is a developer preview. Relay must pin tested revisions and keep DSH APIs behind
an adapter.

## Conclusion

Relay should be one installable DSH bundle composed from small Cordis plugins. DSH is
the Agent runtime; Relay is a waiting, monitoring, routing, and external-message
delivery subsystem. Relay is not the authority for task or conversation lifecycle.

The integration spans two planes:

| Component | Plane | Responsibility |
| --- | --- | --- |
| `relay-runtime-host` | Host | SQLite, Event routing, Delivery Activations, recovery |
| `relay-monitor-host` | Host | Durable scheduling and observer providers independent of live Agents |
| `relay-router-dsh` | Host | Optional semantic-router adapter over DSH LLM services |
| `relay-connector-*` | Host | Normalize email, IM, CI, and source Events |
| `relay-agent-bridge` | Agent | Register/cancel Waits from ordinary Agent turns |
| `relay-dsh-inbox` | Host | Inject Relay Events through DSH's shared Session resolver |

## Session And Message Ownership

There is one Session ID and one conversation: DSH's. Relay stores only a waiting
projection keyed by that ID. It does not mirror the transcript or maintain
`created/running/completed` task state.

Desktop and mobile clients use DSH directly to create conversations, inspect history,
and send user messages. A user message never enters Relay. Relay Events use the same
DSH inbox, so simultaneous human and external messages follow DSH admission order.

An Agent may register Waits in any normal turn. Processing a user message or Relay
Event does not automatically cancel them; the Agent explicitly keeps, replaces, or
cancels them through Relay tools.

## Shared Resolver

At the reviewed revision, `createApiRemoteAgentResolver()` is the correct Host
coordination primitive. It:

- reuses an existing live Agent;
- deduplicates concurrent cold resumes for one Session identity;
- restores Host-specific Agent setup before publication;
- rejects subagent-owned identities through its ownership fence.

`relay-dsh-inbox` must receive this shared resolver from the Host composition. It must
not independently call `ctx.agents.create()` or `ctx.agents.resume()`, reject a live
Agent, acquire a conversation lease, or dispose the resolved Agent.

The adapter sends a plugin-sourced `followup()` with an untrusted, bounded Event
envelope. Calling `whenIdle()` may be part of the first acceptance boundary, but the
production Host still needs a tested durable acknowledgement contract across Session
persistence and process crashes.

## Agent Tools

The Agent plugin installs long-lived tools rather than activation-scoped outcome
hooks:

- `relay_register_waits`: atomically replace current Waits and optionally register or
  rearm Monitors;
- `relay_cancel_waits`: cancel current Waits because the conversation changed course.

There is no `relay_finish_run`, forced turn conclusion, Relay run outcome, or rule
that every Agent turn must mention Relay. DSH continues to decide when a task turn is
done.

## Delivery Reliability

Relay persists Event, routing decision, Delivery, and stable Activation before inbox
injection. A failed adapter call keeps that Activation retryable. The Activation ID
travels with the message so retries can be reconciled.

Relay SQLite and DSH persistence cannot share a transaction. Closing the remaining
crash window requires:

- a Host-defined durable inbox acknowledgement;
- reconciliation against DSH message/tool history before redelivery;
- idempotency keys for action tools such as sending email;
- startup sweeps for uncommitted Activations.

This can provide effectively-once orchestration. Exactly-once external side effects
still require cooperation from target systems.

## Monitor Boundary

DSH Schedule and background jobs are live-Agent features, so they cannot replace
Relay's durable Monitor worker. Monitor execution must survive a cold Agent.

Generated Monitor code must not run in DSH worker-thread Code Runtime as a security
boundary. The initial integration permits built-in declarative detectors and trusted
observer providers only. Arbitrary generated observers require a separate sandbox
and narrow capability broker.

## Validation Sequence

1. Install and unload the Relay bundle in a persistent DSH profile.
2. Register a Wait from an ordinary DSH conversation, make the Agent cold, and inject
   an Event through the shared resolver into the same Session.
3. Send a user message and Relay Event concurrently and prove one DSH inbox order and
   one live Agent.
4. Process an Event, register the next Wait, and repeat several cycles.
5. Crash before and after inbox acknowledgement and prove stable-Activation recovery.
6. Restart with an overdue Monitor and inject its bound Event into a cold Session.

The existing cold-resume probe proved DSH persistence and plugin lifecycle, but its
old Relay-owned Run contract is historical and must not be used as the product model.
