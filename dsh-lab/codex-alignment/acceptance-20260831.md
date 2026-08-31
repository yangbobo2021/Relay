# Codex backend alignment acceptance, 2026-08-31

Historical first-round snapshot. The later cancellation fix and additional
context/real-Desktop validation are recorded in `round2-20260831.md`; do not
interpret the cancellation warning below as the latest candidate's result.

Official DSH reference: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
Live host: installed official DSH `0.1.0-rc.8`, without upstream edits.
Native runtime under test: `0.151.0-alpha.7.2`; model `gpt-5.6-sol`, high effort.
Private profiles, histories, screenshots, package hashes and per-run results stay
outside the repository. This note contains no production transcripts.

## Objective and controls

The operator supplied no additional production tasks. The acceptance suite uses
disposable code, CSV and shell fixtures with independently checked outcomes. It
does not replay a recorded answer or force an expected tool sequence, except in
the explicit one-command error and environment contract tests.

Three configurations run sequentially:

1. Direct native App Server client, without the DSH adapter or session runtime.
2. DSH `native` mode, without DSH dynamic tools or Relay execution guidance.
3. DSH `enhanced` mode, with those extensions enabled.

The direct client shares the process-launch/JSON-RPC client module. It is a
transport reference, not an independent reimplementation or Codex Desktop UI.
The supplied historical Desktop task is compared separately with `run.mjs` and
`compare.mjs`. Neither fixture timings nor one release-status question establish
general intelligence parity.

## Changes and their observable effects

| Change | Observable effect | Evidence scope |
| --- | --- | --- |
| Omit explicit `serviceTier: null` | Preserve the configured/native service tier instead of resetting it | Native start/turn protocol probes and configuration audit |
| Record acknowledged native settings separately from requested settings | A resumed thread with different model/effort is synchronized, rather than assumed correct | Regression tests; native settings audit |
| Honest host identity and capability advertisement | Do not advertise Desktop attestation or MCP App HTML rendering without an implementation | Initialize contract and real handshake |
| Expose native comparison mode | Isolate the effect of DSH tools and Relay instructions while retaining DSH conversation binding | Real fixtures in both modes |
| Preserve dynamic result content and failure state | DSH history shows actual tool output and errors rather than empty/ambiguous rows | Regression tests and prior live dynamic-tool negative probe |
| Abort DSH tools with their owning turn; reject stale replies | A canceled/detached task cannot continue accepting late successful results | Controlled cancellation/ownership tests; live native-command cancellation is a separate case |
| Snapshot background processes before each turn | Cancellation can identify a new command even before its item notification arrives, while preserving earlier background services | Ownership regression and repeated real cancellation |
| Settle active turns on unexpected App Server exit | DSH does not wait forever for a completion that cannot arrive | Transport failure regression test |
| Report only existing dependency paths | Avoid sending the model to nonexistent Desktop runtime locations | Missing/partial runtime fixture tests |

The locale failure was observed during acceptance and is not proven to have
occurred in the user's original sessions. Do not retroactively attribute their
earlier npm failures to it. A child-environment normalization attempt fixed an
ordinary subprocess but failed the real model fixture: native unified exec
overwrites the locale again. The ineffective patch was removed, and both results
are retained. Shell environment snapshots remain disabled for the documented
privacy boundary; copying Desktop flags indiscriminately is not the objective.

## Acceptance oracles

| Case | Independent check |
| --- | --- |
| Code repair | Four unchanged tests pass; test file hash and protected file unchanged |
| CSV | Exact JSON totals, canceled row excluded, source CSV unchanged |
| Error fidelity | Exit 17 and its stderr preserved; next command exits 0 |
| Restart/context | Host restarts, same native thread, second turn recalls nonce and units without shell calls |
| Cancel/recover | Long-command process terminates; next turn completes normally |
| Approval | One fixture-scoped approval allows a write; the next rejection leaves no file |
| Locale | One `shasum` command exits 0 and produces the correct digest, without a model workaround |

The deliberately failing command, red test before a repair, canceled process and
denied approval are expected negative outcomes. They must not count as adapter
defects merely because a UI row says Failed. Unnecessary commands, such as a Git
status check in a non-Git fixture, are recorded separately rather than hidden.

The first approval driver connected to the web endpoint using SSE; the installed
host correctly required WebSocket. Those failed driver runs are retained outside
the repository. The corrected driver consumes `/api/events.mux` over WebSocket,
matches session and exact fixture path, and rejects unexpected requests. It does
not silently approve arbitrary model actions.

## Remaining boundaries

- This is not complete Desktop parity: Desktop-owned browser, computer-use,
  account/UI services, MCP App HTML and attestation require real host adapters.
- Basic MCP elicitation has no complete DSH bridge in this acceptance scope;
  advertising fewer unsupported capabilities is not an implementation of them.
- DSH's aggregate footer can report Tool call 0s for native execution activities.
  Correct command details do not make that aggregate timing authoritative.
- macOS `shasum` can fail with native unified exec's `C.UTF-8` locale in both the
  direct reference and DSH. A valid locale on that particular command is a
  workaround, not proof that the runtime bug has been fixed. See the upstream
  [process manager](https://github.com/openai/codex/blob/main/codex-rs/core/src/unified_exec/process_manager.rs).
- Repeated cancellation probes found two gaps: the initial direct driver cleaned
  up only after interrupt; DSH could miss a command whose item notification had
  not arrived yet. The driver now cleans up before and after; DSH snapshots
  existing processes before starting a turn to distinguish its newly started
  commands. Do not infer Desktop's implementation from the direct test driver,
  or infer reliable cancellation from a single successful attempt.
  A subsequent repeated DSH native-mode run still left one child alive after the
  cancellation deadline, despite the baseline patch. The remaining race is not
  resolved; this candidate must not be described as fully accepted for production
  cancellation. Retain the failing case and investigate native process registration
  and cancellation ordering before replacing an everyday profile.
- Long-context compression, multimodal flows, cloud work, Windows and Linux have
  not received fresh end-to-end acceptance in this run.
- A matching native binary does not make all host instructions, skills, tools,
  environment, cache state or service scheduling identical.
- The default package dependency remains `@openai/codex@0.149.0`. The tested
  profile explicitly selects the reference binary; installing the candidate
  alone does not reproduce the tested runtime configuration.
- No original DSH profile or official checkout was replaced. Candidate artifacts
  are local, unpublished and distinguished by hashes, not a new public version.

## Reproduction and deployment boundary

Run `npm run verify` in the Codex integration, build a candidate tarball, then
execute `suite.mjs --tasks repair,csv,error,memory,cancel,locale` and a separate
`--tasks approval --permission workspace-write` run using the parameters in
README.md. Use fresh output directories and retain failed attempts.

For deployment, archive the existing plugin and profile patch, install the tested
candidate, and set `codexCommand` to a compatible runtime validated on that host.
Rollback restores both the prior package and profile configuration. Do not copy
Desktop binaries into a public plugin distribution, change the global Codex
configuration, rewrite an existing native thread's history, or update Relay's
submodule pointer to an unpublished child commit as part of this local test.
