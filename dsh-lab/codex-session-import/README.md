# Codex Session Import Evidence

This directory stores sanitized, reproducible evidence for the protocols in
`docs/spec/codex-session-import-validation/`.

## Rules

- Never use or commit a real user's conversation content.
- Run destructive lifecycle checks only against temporary Codex profiles and
  temporary Workspaces.
- Do not record credentials, account identifiers, private absolute paths, opaque
  compaction payloads, or unredacted App Server traffic.
- Use stable hashes when a Thread or Session identity must be correlated.
- Keep the official DSH checkout clean and record its exact commit in every run.
- Do not edit an accepted run. Add a new run with a new UTC run ID.

## Layout

```text
<risk-id>/<run-id>/
  manifest.json
  commands.log
  observations.jsonl
  result.md
  artifacts/
```

`manifest.json` must validate against `evidence-manifest.schema.json`. The top-level
`risk-register.json` is the machine-readable mirror of the normative risk status
table. `environments/` contains reusable, non-sensitive environment snapshots.

Run directories are added only when an experiment has actually run. An absent risk
directory therefore means `not-run`, not that evidence was lost.

## Reproduce The Assessment

Run the probes and capture exact timestamps, sanitized output, and hashes:

```bash
node dsh-lab/codex-session-import/capture-assessment-runs.mjs
node dsh-lab/codex-session-import/generate-evidence.mjs
node dsh-lab/codex-session-import/verify-evidence.mjs
```

The capture step creates and then permanently deletes only synthetic, uniquely marked
Codex Threads. It also removes every temporary Workspace and verifies each deletion.
Do not interrupt it during cleanup. The generator converts the captured runs into one
accepted evidence package per risk, and the verifier checks manifests, artifact hashes,
risk-register consistency, and local documentation links.
