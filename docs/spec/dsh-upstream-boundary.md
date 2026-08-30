# DSH Upstream Boundary Specification

## Scope

This specification defines the immutable boundary between Relay and the official
DeepSeek Harness source. It applies to humans, Agents, scripts, tests, and release
automation operating in this repository.

## Official Source

Relay's DSH source reference MUST come directly from:

```text
https://github.com/deepseek-ai/deepseek-harness.git
```

The reference checkout is `upstream/deepseek-harness/`. It MUST remain ignored by
Relay Git and MUST NOT be replaced by a Fork, vendored copy, or patched distribution.

## Immutability Requirements

Relay work MUST NOT:

- edit, add, delete, or rename tracked files in the DSH checkout;
- create DSH commits, branches, merges, rebases, or tags;
- push any ref from the DSH checkout;
- apply or maintain Relay product patches inside DSH source;
- copy private Relay implementation into DSH;
- make Relay runtime behavior depend on a non-official DSH commit.

The checkout MAY be used to fetch and inspect official history, install dependencies,
build official artifacts, run official tests, and generate ignored local output.
Those operations MUST leave tracked and untracked non-ignored DSH source clean.

## Extension Requirement

Every Relay capability MUST integrate through an official DSH extension boundary or
an external Relay-owned adapter. This includes Codex and Claude conversations, Waits,
Monitors, Events, file browsing, terminal access, and workbench presentation.

Persistent implementation MUST live in independent plugin repositories under
`integrations/` (including Events, Semantic Router and Monitors). Compatibility experiments and sanitized evidence
MUST live under `dsh-lab/`. A Cordis profile patch distributed inside the Relay
plugin is an external composition input and MUST NOT patch DSH source files.

If official DSH lacks a required extension point, Relay MUST choose one of these
paths:

1. implement a replaceable external adapter or plugin surface;
2. defer the capability;
3. propose a generic upstream extension through a separate clone and explicitly
   approved contribution workflow.

Relay's official reference checkout has no contribution exception.

## Synchronization Invariants

After `scripts/sync-dsh.sh` completes:

- `origin` fetches the official URL;
- `origin` cannot be used for push by the Relay workflow;
- no Fork remote is configured;
- `HEAD` is detached at the fetched official `master` commit;
- the DSH worktree has no tracked or non-ignored source changes.

Compatibility records MUST identify that exact commit. A claim about a newer DSH
revision is invalid until the plugin has been checked against it.
