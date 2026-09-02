# Process-exit reference Bundle

Use this only after the live catalog has no matching Bundle Type and
`relay_issue_process_handle` returned an authorized opaque `handle`.

The module is deterministic and asks the broker for exactly one approved read:

```js
globalThis.monitor = {
  observe(context) {
    return {
      provider: "process.read",
      operation: "status",
      arguments: { handle: context.config.handle }
    }
  },
  detect(previous, current) {
    return previous?.status === "running" && current.status === "exited"
      ? [{
          type: "process.exited",
          key: current.identity,
          data: current
        }]
      : []
  }
}
```

The manifest must contain:

- `contract_version: 1` and a namespaced `custom.*` type ID;
- only `process.exited` in `event_types`;
- one `process.read.status` grant whose arguments contain the exact issued Handle;
- the same Handle in `config`;
- `one_shot` lifecycle and a bounded interval/jitter;
- an explicitly zoned future `expires_at` no more than 30 days away;
- closed observation and Event-data schemas requiring `identity`, `status`, and
  `exit_code_available`;
- observation status enum `running | exited`, Event status const `exited`, and
  `exit_code_available: false` unless the provider explicitly supplies supervised
  exit-code evidence;
- complete `en-US` and `zh-CN` name, description, permission, and remediation text.

Expected transition table:

| Previous | Current | Events |
| --- | --- | --- |
| none | running | none; store baseline |
| running | running | none |
| running | exited | one `process.exited` |
| exited | exited | none; one-shot Monitor is already inactive |
| any | identity lost, malformed, or denied | no Event; record a redacted check failure |

Never infer exit from a missing/reused PID. The provider must fail closed when the
signed host, Session, project, PID, or start identity no longer matches.
