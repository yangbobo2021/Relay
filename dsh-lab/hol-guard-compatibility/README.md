# HOL Guard / Relay Codex Smoke Test

Validation date: 2026-08-31 (Asia/Shanghai).

## Scope

This follows [kantorcodes1's smoke-test instructions](https://www.reddit.com/r/DeepSeek/comments/1w230u9/comment/p6w7j46/):
install HOL Guard for Codex and attempt `rm -rf ~/hol-guard-smoke` against a
disposable directory. It tests the real third-party Guard, not our earlier
handwritten hook fixture.

Three execution paths use the same command and isolated Guard installation:

- Native Codex CLI.
- Relay's `CodexAppServerClient` / `CodexSessionRuntime`.
- The official DSH Web host with `relay-dsh-plugin-codex`, driven through its
  actual session RPC and approval WebSocket/HTTP interfaces.

The execution engines and hooks are real. Model responses are deterministic
local Responses API fixtures, not live model inference. Each main conversation
gets one shell call through the advertised `functions.exec` custom tool, then a
final response. No model credentials or everyday user configuration are used.

## Versions

| Component | Tested version / checkout |
| --- | --- |
| HOL Guard | PyPI `hol-guard==3.0.1` |
| Codex | `codex-cli 0.149.0` |
| Relay Codex plugin | `0.1.6-rc.1`, `90b3038ed4eca4cf43a4df2049180f8f1f134811` |
| Official DSH | `0.1.1-rc.2`, `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` |
| Python | 3.12.4, isolated virtual environment |

The inspected [HOL Guard source](https://github.com/hashgraph-online/hol-guard)
was at `5f1c1667cf23646efebe9afe6828bc550fa7a8eb`. This is source-inspection
provenance, not a claim that the published wheel was built from that exact commit.
The dependency lock contains PyPI distribution hashes. Downloads used the
Tsinghua PyPI mirror with hash verification; the macOS `litellm` dependency
required a Rust build. `uv pip check` passed for all 100 installed packages.

## Results

The machine-readable [evidence.json](evidence.json) is generated only after all
suite assertions pass. It contains 22 scenario results across six suites.

| Scenario | Native CLI | Relay runtime | Full DSH main session |
| --- | --- | --- | --- |
| No Guard, `rm -r ./hol-guard-smoke` | Directory deleted | Not separately run | Directory deleted |
| Guard installed, hooks untrusted, `rm -rf ~/hol-guard-smoke` | Codex policy rejects | Codex policy rejects | Native approval requested; test driver rejects |
| Guard installed, explicit hook exception, same `rm -rf` | Guard blocks | Guard blocks | Guard blocks |
| Guard installed, hooks untrusted, `rm -r ./hol-guard-smoke` | Directory deleted | Directory deleted | Directory deleted |
| Guard installed, explicit hook exception, same `rm -r` | Guard blocks | Guard blocks | Guard blocks |
| Guard installed, explicit hook exception, `printf GUARD_SAFE_COMMAND` | Marker printed | Marker printed | Marker printed |

Every Guard-blocked case preserves both the directory and its sentinel file.
It also produces an actual `PreToolUse` receipt with `policy_decision: block`
and the tested command, plus a tool failure explicitly naming HOL Guard.
The runtime emits `hook/started` and blocked `hook/completed` notifications.
Full-DSH block receipts must match the **main session's bound Codex thread**;
they do not belong to DSH's separate title-generation thread. No native approval
was rejected by the driver in the Guard-blocked cases.

For the original `rm -rf` command, the full-DSH receipt is
`guard-receipt-43d171e8-d7c6-4dd3-b7c4-4c07846b1803`, matching main thread
`01a05591-3362-7491-b35c-31f112ceb3bd`.

## Interpretation

**The tested HOL Guard PreToolUse interception works through the current Relay
Codex plugin and full DSH host, when the installed hooks are allowed to run.**
This is not an install-only or comprehensive compatibility claim.

1. Installation is not hook trust. The installer registers four enabled user
   hooks: `PreToolUse`, `PermissionRequest`, `PostToolUse`, and `UserPromptSubmit`.
   In fresh homes, `hooks/list` reports all four as `untrusted`. No hook events or
   Guard receipts appear without an explicit exception, in CLI or Relay runtime;
   full DSH likewise produces no Guard receipts and allows the non-force control.
2. Reviewed runs use invocation-only `--dangerously-bypass-hook-trust`, confined
   to fresh homes containing only this reviewed Guard installation. The runtime
   propagates it to thread configuration. It does not create persistent trust;
   `hooks/list` can still report `untrusted`. This flag is **not a recommendation
   to trust arbitrary hooks in a normal user environment**.
3. An intact directory alone is insufficient evidence. In this Codex version,
   `rm -rf` is rejected by the CLI's native command policy under `approval=never`
   even without Guard. DSH uses `approval=ask`; the driver records and rejects
   native approval requests, never grants them. The non-force workspace command
   proves actual deletion is otherwise possible under the same sandbox.
4. `hol-guard command test` returns `review` for recursive deletion, with
   `policy_evaluation: not_run` and `side_effects: none`. That is classification,
   not a runtime denial. `hol-guard events` returned no lifecycle entries;
   runtime proof is in `hol-guard receipts` and Codex hook notifications.

## Isolation And Limitations

Every case gets a new temporary `HOME`, `CODEX_HOME`, workspace, Guard state,
and DSH profile. Deletion commands target only the freshly created smoke
directory. No real account state is copied. Sandbox mode stays `workspace-write`.
Guard desktop notifications, cloud synchronization, and telemetry are disabled;
the approval surface is `native-only`. No custom risk rules were added.

This does not test persistent hook-trust UI, live model behavior, browser
presentation, Guard's interactive PermissionRequest approvals, all tools,
all Guard rules, or versions other than those listed above. It is not another
run of the broader 162-case migration suite. No production code or immutable
DSH source was modified, and no Reddit reply was posted by this experiment.

An early probe sent its shell call to DSH's title-generation thread and observed
read-only permission failures. Those runs were discarded. The final probe
answers title requests separately, asserts exactly two main model requests,
and checks receipt-to-main-thread identity. A separate early run waited for
native approval; the final driver records and rejects such requests explicitly.

## Reproduction

Use the pinned checkouts above and their existing built dependencies. Run from
the Relay root with a current Node runtime supporting `WebSocket` (tested with
Node 25.5.0). Python 3.12 and a Rust toolchain may be needed for installation:

```sh
LAB=$(mktemp -d /tmp/relay-hol-repro-XXXXXX)
uv venv --python 3.12 "$LAB/venv"
uv pip install --python "$LAB/venv/bin/python" --require-hashes \
  -r dsh-lab/hol-guard-compatibility/requirements.txt
uv pip check --python "$LAB/venv/bin/python"
node dsh-lab/hol-guard-compatibility/run-suite.mjs \
  "$LAB/venv/bin/hol-guard" "$LAB/reports"
node dsh-lab/hol-guard-compatibility/summarize.mjs \
  "$LAB/reports" "$LAB/evidence.json"
```

The runner intentionally enables the hook-trust exception only in its reviewed
test cases; inspect the installed hooks before running it. The Guard install is
performed with explicit temporary `--home` and `--guard-home` paths. Each case
prints its raw-artifact directory and stops its Guard daemon and DSH/Codex
processes on completion. Raw files stay outside the repository. The compact
evidence omits full configs, embedded executable paths, and user-state files.
