# Preserve native Codex service tier

Official DSH reference: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
Native runtime probed: `0.151.0-alpha.7.2`.

The Codex plugin previously sent `serviceTier: null` in `thread/start`,
`thread/fork`, and `turn/start`. This field is not an ordinary optional string:
an explicit null resets the service tier, whereas omission preserves the native
configuration or existing thread setting.

Real ephemeral App Server probes with an existing `service_tier = "priority"`
configuration returned these effective settings:

| Operation | Field | Effective tier |
| --- | --- | --- |
| thread/start | omitted | priority |
| thread/start | null | default |
| thread/start | priority | priority |
| turn/start on a priority thread | null | default (settings update notification) |
| turn/start on a priority thread | omitted | no settings reset |

The correction omits the field from all three lifecycle requests. It does not
force priority on users, alter permissions, or change their global configuration.
Existing threads previously reset to default are not silently rewritten; this
change prevents subsequent resets. The lifecycle tests check field absence on
creation, resume, every subsequent turn, and the exact fork request.

Latency comparisons must still distinguish tool execution from model output
generation. A shorter tool-call count does not imply the same generated code or
query scope. Preserve raw run evidence privately, and do not use a single task
or a few repetitions to claim general intelligence or speed parity.
