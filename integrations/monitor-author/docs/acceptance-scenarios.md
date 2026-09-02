# Monitor Author DSH Plugin Acceptance

| ID | Scenario | Required result |
| --- | --- | --- |
| MA-001 | DSH package identity | Manifest, export, and Cordis patch identify `relay-dsh-plugin-monitor-author`; no Codex plugin manifest is shipped. |
| MA-002 | Native DSH discovery | Loading the packed plugin adds exactly one `relay-monitor-author` entry to `ctx.skills`. |
| MA-003 | Native DSH loading | DSH resolves the entry through its Skill registry and returns the packaged body plus resource directory. |
| MA-004 | Invocation policy | The Skill is both model- and user-invocable, so DSH can advertise it and accept `/relay-monitor-author`. |
| MA-005 | Lifecycle | Plugin disposal removes its entry and does not remove another provider's Skill. |
| MA-006 | Plugin preference | Instructions list live types before creation and prohibit custom code when an available type matches. |
| MA-007 | Custom fallback | Instructions require a minimum read-only capability, validation receipt, exact install, expiry, schemas, and bilingual presentation. |
| MA-008 | Failure boundary | Missing tools, denied capability, failed validation/baseline, or missing durable IDs cannot be reported as success. |
| MA-009 | Packed official DSH | A fresh official DSH profile installs the tarball, discovers the Skill in a real DSH Session, and creates a typed Monitor through that Session's Relay tool. |
| MA-010 | Artifact hygiene | Packed contents contain no install scripts, secrets, private paths, database/log files, or undeclared imports. |
