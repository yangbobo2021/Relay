# Codex Integration

[`routing-adapter.mjs`](routing-adapter.mjs) runs Relay's provider-independent
semantic routing prompt through an ephemeral, read-only `codex exec` process. It
returns only structured output and token/latency telemetry to the event router.

The adapter does not own routing policy, candidate construction, or decision
validation. Those remain in [`packages/event-router`](../../packages/event-router/README.md).
