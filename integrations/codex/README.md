# Codex Integration

[`routing-adapter.mjs`](routing-adapter.mjs) runs Relay's provider-independent
semantic routing prompt through an ephemeral, read-only `codex exec` process. It
returns only structured output and token/latency telemetry to the event router.

The adapter does not own routing policy, candidate construction, or decision
validation. Those remain in [`packages/event-router`](../../packages/event-router/README.md).

[`app-server-client.mjs`](app-server-client.mjs) implements the JSON-RPC stdio
transport for a local Codex App Server. [`session-runtime.mjs`](session-runtime.mjs)
owns transport-level Thread state and incremental App Server notifications. Relay
Activations enter through DSH's normal inbox rather than this transport runtime.
The native DSH Web integration is implemented in
[`integrations/deepseek-harness`](../deepseek-harness): DSH owns the visible Session,
while Codex retains model-context and execution ownership.
