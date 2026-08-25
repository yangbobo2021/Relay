# Experiment Protocol

## Required Phases

Each risk must be evaluated in two separately recorded phases.

### Risk Reproduction

The first phase tests the unmitigated behavior and determines whether the stated
risk is observable. It must record inputs, commands or RPC requests, responses,
timestamps, identifiers reduced to non-sensitive stable hashes, and an explicit
pass, fail, or inconclusive result.

### Solution Validation

The second phase runs the same scenario after the proposed mitigation is enabled.
It must include a negative control or failure injection where practical. A solution
is not `verified` merely because the happy path works.

## Environment Matrix

Every accepted run records:

- Relay commit and dirty-worktree state;
- Codex plugin commit and package version;
- official DSH commit and package version;
- Codex CLI and App Server version;
- operating system, architecture, Node.js, and npm versions;
- temporary profile configuration and feature flags;
- whether the Thread originated in Codex Desktop, Codex CLI, or DSH;
- normalized Workspace identity without private path components.

At minimum, release validation covers one clean temporary profile and one upgrade
profile from the previously supported plugin version. CSI-002 and CSI-006 additionally
cover each available Codex entry point.

## Evidence Rules

- Use synthetic conversations and temporary Workspaces. Never commit real user text,
  credentials, account identifiers, absolute home paths, or production logs.
- Replace Thread and Session identifiers with stable SHA-256 prefixes when identity
  correlation is necessary.
- Preserve exact RPC method names, status codes, field presence, counts, timings, and
  payload byte sizes. Redact only sensitive values.
- Record stdout and stderr separately when that distinction affects the conclusion.
- Compute SHA-256 for every committed fixture and artifact.
- A run directory is immutable after acceptance. Corrections require a new run ID.

## Run Naming

Use UTC timestamps and a short scenario name:

```text
20260825T083000Z-cli-to-dsh-resume
```

## Required Files

`manifest.json` follows
`dsh-lab/codex-session-import/evidence-manifest.schema.json`. It identifies the
environment, scenario, result, metrics, and artifact hashes.

`commands.log` contains reproducible commands with secrets and private paths replaced
by declared placeholders. Interactive UI steps must include stable control labels and
screenshots in `artifacts/`.

`observations.jsonl` contains timestamped machine-readable observations. Each line is
an object with `time`, `phase`, `operation`, `outcome`, and optional `metrics`.

`result.md` contains:

1. the tested hypothesis;
2. actual versus expected behavior;
3. pass/fail evaluation for every gate;
4. limitations and residual risks;
5. the resulting risk status recommendation.

## Acceptance Rules

- Two consecutive clean runs are required for P0 behavioral correctness risks.
- Crash and retry risks require at least one deterministic failure-injection run.
- Performance gates require at least five measured runs and report median, p95, and
  maximum values.
- Protocol compatibility requires current and previous supported version fixtures.
- An inconclusive run cannot change a risk to `verified` or `accepted`.
- Updating a risk status requires updating both its specification and the
  machine-readable risk register in the same change.
