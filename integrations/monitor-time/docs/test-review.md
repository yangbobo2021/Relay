# Relay Time Monitor Bundle Test Review

The separation test was written before removing Time from Core and failed against
`createTimerWait`, `deadline_reached`, and `relay_schedule_timer`. Time tests execute
the public registries, official DSH tool compiler, provider observation/detection,
deadline boundary matrix, Session derivation, unload disposer, package manifest, and
tarball dry run. Cross-package acceptance, rather than this unit suite, owns restart,
migration, official-DSH lifecycle, and browser evidence.

The root Cordis lifecycle test also creates `time.deadline` through Core's generic
Agent tool, crosses the registered factory/provider, commits to real in-memory
SQLite Events state, and inspects the authenticated Session owner. Its first run
found the shared-reference/cycle distinction in Core, so this path is not a mocked
success assertion.

The final migration gate persists the legacy `clock` and `deadline_reached` shape to
a real SQLite file, closes the runtime, reopens through Time's compatibility alias,
and proves the original version, Wait, deadline, baseline, continuation, Session, and
trigger key. Final Time verification discovers 6/6 tests with zero skip/todo. The
external root acceptance report records the final package SHA-256 so the tarball does
not self-reference its own hash.
