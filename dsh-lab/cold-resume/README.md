# DSH Session And Relay Inbox Probe

This experiment validates Relay's corrected DeepSeek Harness boundary against DSH
commit `47f943859bef60e4160492346772ded9b24f765a` (`0.1.0-rc.5`).

Install the DSH dependency closure in the ignored upstream checkout, then run:

```bash
npm run experiment:dsh
```

## Checks

`bundle-smoke.mjs` installs the local bundle into a temporary DSH profile and verifies
Host plugin load and disposal.

`run.ts` proves that DSH alone creates, persists, cold-resumes, and continues one
ordinary conversation. Relay is absent from this lifecycle check.

`runtime-run.ts` proves the integration contract:

```text
DSH creates ordinary conversation
  -> Agent calls relay_register_waits
  -> Agent becomes cold
  -> Relay routes a synthetic email
  -> DSH shared resolver resumes the existing Session
  -> Relay injects through the normal DSH inbox
  -> Agent registers its next Wait
```

The probe asserts zero Relay Runs, one committed Delivery Activation, two Agent Wait
tool calls, one active replacement Wait, and reuse of the original DSH Session ID.

`timer-run.ts` proves the first installable Host-plugin path: an Agent calls
`relay_schedule_timer`, becomes cold, and is resumed through DSH's configured shared
Agent lookup when Relay emits the bound `timer.elapsed` Event. The resumed turn must
also publish DSH's normal `running -> idle` status lifecycle used by Web clients.

## Boundary

The Agent bridge exposes registration tools only. `DshInboxAdapter` receives
`createApiRemoteAgentResolver()` from the Host and never creates, independently
resumes, or disposes an Agent. The probe's acknowledgement waits for Agent idle and
flushes Session persistence.

The Host bundle now runs the timer-only vertical slice. Crash injection around
durable inbox acknowledgement, concurrent user/Event ordering, startup Activation
reconciliation, and external-tool idempotency remain subsequent validation steps.

## Result

Passed on 2026-08-14:

- bundle lifecycle loaded and disposed cleanly;
- one DSH Session retained history across a cold resume;
- Relay delivery used the shared resolver and existing inbox;
- the Agent replaced its consumed customer-reply Wait with a survey Wait;
- Relay created no conversation Run or task-completion state.
- a persisted one-shot timer cold-resumed its owning Session through the shared DSH
  Agent lookup.
