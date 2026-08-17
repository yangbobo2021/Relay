# Codex Parity Trace Report

Date: 2026-08-17

## Scope

This report covers the current Relay/Codex parity target:

- Plain text user input.
- Image plus text user input.
- Permission selector behavior after a failed permission switch.
- Model and reasoning effort selection.

Relay intentionally still injects its own dynamic tools:

- `relay_wait_for_event`
- `relay_cancel_waits`

The only currently exposed `codex_app` namespace tool is:

- `codex_app.load_workspace_dependencies`

Other Codex App tools remain intentionally unsupported until Relay/DSH can
truthfully execute equivalent behavior.

## Conclusion

The current parity scope is accepted at trace level. Relay and native Codex UI now
match on the normalized App Server request shape for plain text, image plus text,
failed permission-switch recovery, effective model/reasoning-effort selection, and
`AGENTS.md` rollout.

Successful permission switching is intentionally not claimed in this report because
that native trace has not been collected yet.

## Evidence

Native Codex UI JSON-RPC trace:

```text
/Users/boboyang/test4/codex_trace/raw_jsonrpc/stdio-20260817-100348-pid92385.frames.jsonl
```

Relay text/image JSON-RPC trace:

```text
/Users/boboyang/test4/codex_trace/relay_parity/raw_jsonrpc/stdio-20260817-111236-pid45630.frames.jsonl
```

Native Codex rollout:

```text
/Users/boboyang/test4/codex_trace/codex_home_bundle/sessions/2026/08/17/rollout-2026-08-17T10-10-03-01a00d7b-a935-78c2-a100-6e26149b6082.jsonl
```

Relay rollout:

```text
/Users/boboyang/test4/codex_trace/relay_parity/codex_home/sessions/2026/08/17/rollout-2026-08-17T11-12-36-01a00db4-ed16-76b0-a5f5-56423981816d.jsonl
```

Relay permission-failure JSON-RPC trace:

```text
/Users/boboyang/test4/codex_trace/relay_parity/raw_jsonrpc/stdio-20260817-115629-pid80872.frames.jsonl
```

Native Codex UI model/effort JSON-RPC trace:

```text
/Users/boboyang/test4/codex_trace/raw_jsonrpc/stdio-20260817-121527-pid95943.frames.jsonl
```

Relay model/effort JSON-RPC trace:

```text
/Users/boboyang/test4/codex_trace/relay_parity/raw_jsonrpc/stdio-20260817-130044-pid32003.frames.jsonl
```

## Normalized Check

Run:

```sh
node scripts/compare-codex-parity-trace.mjs \
  --native /Users/boboyang/test4/codex_trace/raw_jsonrpc/stdio-20260817-100348-pid92385.frames.jsonl \
  --relay /Users/boboyang/test4/codex_trace/relay_parity/raw_jsonrpc/stdio-20260817-111236-pid45630.frames.jsonl \
  --native-rollout /Users/boboyang/test4/codex_trace/codex_home_bundle/sessions/2026/08/17/rollout-2026-08-17T10-10-03-01a00d7b-a935-78c2-a100-6e26149b6082.jsonl \
  --relay-rollout /Users/boboyang/test4/codex_trace/relay_parity/codex_home/sessions/2026/08/17/rollout-2026-08-17T11-12-36-01a00db4-ed16-76b0-a5f5-56423981816d.jsonl \
  --permission-relay /Users/boboyang/test4/codex_trace/relay_parity/raw_jsonrpc/stdio-20260817-115629-pid80872.frames.jsonl \
  --model-native /Users/boboyang/test4/codex_trace/raw_jsonrpc/stdio-20260817-121527-pid95943.frames.jsonl \
  --model-relay /Users/boboyang/test4/codex_trace/relay_parity/raw_jsonrpc/stdio-20260817-130044-pid32003.frames.jsonl
```

Result:

```text
PASS turn-start:text
PASS turn-start:image
PASS rollout:agents-md
PASS permission:failed-switch-preserves-effective-workspace-write
PASS model-effort:turn-start-sequence
PASS model-effort:settings-update-sequence
PASS model-effort:native:turn-start-top-level-null
PASS model-effort:relay:turn-start-top-level-null
PASS model-effort:native:single-business-thread
PASS model-effort:relay:single-business-thread
```

## Notes

The checker intentionally ignores dynamic IDs, timestamps, and concrete
visualization directory names. It compares the stable request shape:

- request text
- image input shape
- attachment count, label, and basename
- `cwd`
- `approvalPolicy`
- `approvalsReviewer`
- `sandboxPolicy` or `permissions` shape
- `runtimeWorkspaceRoots` shape
- `model` and reasoning effort from `collaborationMode`
- `serviceTier`, `summary`, `personality`, `multiAgentMode`, and `outputSchema`
- `AGENTS.md` rollout presence and content hash

The permission-failure case verifies that a failed DSH permission switch does
not leak the log-only `permission/preset` event into the next Codex
`turn/start` request. The effective authority remains the last successful
`sandbox/mode` and `approval/policy` knob events.

The model/effort trace verifies that `turn/start` carries the same effective values
through `collaborationMode.settings` while top-level `model`, `effort` and
`serviceTier` remain null. Native Codex Desktop records every model menu transition;
DSH currently exposes the final effective selector state at submit time, so the
settings-update comparison checks the final `thread/settings/update` before each
business turn rather than every intermediate UI click.

Verification also ran the full repository test suite:

```text
npm test
79 passing
```
