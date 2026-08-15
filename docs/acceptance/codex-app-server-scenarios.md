# Codex In Native DSH Web Acceptance Scenarios

| ID | Acceptance scenario | Requirements | Evidence |
| --- | --- | --- | --- |
| `CXA-001` | Native New Session hero lists Codex; selecting it keeps the hero and allows switching back before first send | `CXS-001`, `CXS-007` | Browser |
| `CXA-002` | First native submit creates one bound Thread with the Session cwd | `CXS-002`, `CXS-005` | Automated + Live |
| `CXA-003` | Two appended turns use the same Thread and preserve Codex context | `CXS-003` | Automated + Live + Browser |
| `CXA-004` | Switch away and back, then continue the same Thread | `CXS-004`, `CXS-006` | Live + Browser |
| `CXA-005` | Restart Host/browser and recover both binding and native activity history | `CXS-004`, `CXS-011`, `CXS-021` | Automated + Live |
| `CXA-006` | Concurrent first sends deduplicate; separate Sessions stay isolated | `CXS-002`, `CXS-005` | Automated |
| `CXA-007` | Codex uses the native header, Chat/Trajectory projections, composer, queue, cancel and message actions; diagnostic visibility follows the global advanced setting | `CXS-007`, `CXS-008`, `CPS-001`, `CPS-003` | Browser |
| `CXA-008` | Native model selector shows Codex models/efforts; native permission control drives sandbox/approval | `CXS-009` | Automated + Browser |
| `CXA-009` | Only the newest human message reaches Codex; injected DSH context is excluded | `CXS-003` | Automated |
| `CXA-010` | Reasoning and commentary stream before final completion through native Assistant rows | `CXS-008`, `CXS-014` | Automated + Live + Browser |
| `CXA-011` | Command and representative tool items appear at start and settle with output/status | `CXS-010`, `CXS-011` | Automated + Live + Browser |
| `CXA-012` | Generated image is imported and shown by DSH's native image gallery | `CXS-012` | Automated + Live + Browser |
| `CXA-013` | Command/file/permission requests use native approval UI and fail closed | `CXS-013` | Automated + Browser |
| `CXA-014` | Tool input uses native question UI and returns protocol-shaped answers | `CXS-013` | Automated + Browser |
| `CXA-015` | Agent/integration-created Wait is visible and cancellable in Relay settings, not conversation chrome | `CXS-015`, `CXS-019` | Automated + Browser |
| `CXA-016` | Matching external Event resumes the same Thread through normal Relay Delivery/Activation | `CXS-016`, `CXS-017` | Automated + Live |
| `CXA-017` | Busy Session queues the event in DSH order; pre-acceptance failure retains the Activation for retry | `CXS-017` | Automated |
| `CXA-018` | Duplicate/unmatched/background Events do not create turns or change selected Session | `CXS-018` | Automated |
| `CXA-019` | Production bundle contains no manual Wait/Event trigger, `xx.completed`, or Demo page | `CXS-019` | Static + Browser |
| `CXA-020` | Loopback webhook accepts a JSON Event and returns its durable Delivery; remote callers require the configured bearer token | `CXS-020` | Automated + Live |
| `CXA-021` | Timeout, process exit, unsupported request, cancellation and image failure are explicit | `CXS-021` | Automated |
| `CXA-022` | Persisted activity events cold-resume under the pinned DSH build | `CXS-011`, `CXS-022` | Automated |
| `CXA-023` | Desktop and 390x844 layouts retain native DSH composition without overlap | `CXS-023` | Browser screenshots |
| `CXA-024` | Automatic title generation may overlap the first business turn but uses a different ephemeral Thread; the main Thread contains only the human request and complete answer | `CXS-003`, `CXS-024` | Automated + Live + Browser |
| `CXA-025` | Title failure releases the temporary Thread and retains DSH fallback without changing the main binding or conversation events | `CXS-024` | Automated |
| `CXA-026` | Expanding a native Codex activity row identifies Codex App Server and its Thread/Turn provenance | `CXS-025` | Automated + Browser |
