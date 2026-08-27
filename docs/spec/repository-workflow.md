# Repository Workflow Specification

## Purpose

Relay, its independently released DSH plugins, and DeepSeek Harness have separate
Git histories. Relay is the distribution and event-runtime repository. The nested
DSH checkout is a synchronized, read-only compatibility reference governed by the
[DSH Upstream Boundary](dsh-upstream-boundary.md).

## Repository Boundaries

The Relay repository owns the event runtime, distribution composition,
cross-plugin tests, specifications, and reproducible probes. Independently
released DSH plugins are pinned as Git submodules:

- `integrations/codex/` -> `git@github.com:yangbobo2021/relay-dsh-plugin-codex.git`
- `integrations/claude/` -> `git@github.com:yangbobo2021/relay-dsh-plugin-claude.git`
- `integrations/dsh-workbench/` -> `git@github.com:yangbobo2021/relay-dsh-plugin-workbench.git`
- `integrations/dsh-files/` -> `git@github.com:yangbobo2021/relay-dsh-plugin-files.git`
- `integrations/dsh-terminal/` -> `git@github.com:yangbobo2021/relay-dsh-plugin-terminal.git`
- `integrations/dsh-plugin-manager/` -> `git@github.com:yangbobo2021/relay-dsh-plugin-manager.git`

Relay owns only their Git commit pointers. Source changes, releases, tags, lockfiles,
and plugin-specific CI belong to their respective repositories.

`upstream/deepseek-harness/` is an ignored checkout of the official repository:

```text
https://github.com/deepseek-ai/deepseek-harness.git
```

It is not a Relay submodule, release artifact, writable downstream, or place to
maintain product patches. Its checked-out commit is only an input to Relay builds and
compatibility verification.

## Official Checkout

The checkout has one remote role:

- `origin` fetches the official DSH repository.

Relay does not configure a Fork remote. The local `origin` push URL is deliberately
disabled, and normal synchronization leaves the checkout detached at the fetched
official `master` commit. A local DSH branch is never an integration branch.

Run the repository helper to create or update the checkout:

```bash
scripts/sync-dsh.sh
```

The helper requires a clean DSH worktree, corrects legacy remote configuration,
fetches official `master`, checks out the fetched commit detached, and prints the
exact revision. It must stop rather than overwrite local DSH changes.

## Relay Development

Relay-owned DSH-facing implementation belongs under one of these locations:

- `integrations/deepseek-harness/` for the installable plugin and runtime adapters;
- `integrations/codex/`, `integrations/claude/`, `integrations/dsh-workbench/`,
  `integrations/dsh-files/`, `integrations/dsh-terminal/`, and
  `integrations/dsh-plugin-manager/` for pinned independent plugin checkouts;
  changes must be committed and pushed in the child repository first;
- `dsh-lab/` for compatibility notes, fixtures, probes, and patch reproductions;
- `docs/` for specifications, design decisions, and operating guidance;
- Relay test directories for cross-boundary contract coverage.

When an official update changes an API, adapt the affected plugin in its owning
repository. Do not carry the compatibility fix as a DSH source commit. A generally
useful missing extension point may be documented as an upstream proposal, but work
on that proposal must use a separate clone and process outside Relay's official
reference checkout.

## Plugin Submodule Workflow

Clone a complete Relay distribution with:

```bash
git clone --recurse-submodules <relay-repository>
```

After pulling a Relay commit that advances plugin pointers, run:

```bash
git submodule update --init --recursive
```

To update a plugin, work and verify inside its submodule, commit and push that child
repository, then stage only the resulting gitlink in Relay. Relay must never record
a dirty or unpublished child commit. A submodule update is accepted only when the
plugin's own `npm run verify`, package dry run, Relay boundary tests, and official
DSH installation scenarios pass.

## Update Workflow

1. Require the Relay and DSH worktrees to be clean enough to identify intended
   changes independently.
2. Run `scripts/sync-dsh.sh` and record the printed DSH commit.
3. Build and type-check all selected DSH plugins against that checkout.
4. Install the packed plugins into pristine official DSH profiles, both separately
   and in the supported distribution combinations.
5. Run affected Relay tests and browser compatibility workflows.
6. Record the tested official commit in the relevant Relay note or document.

## Mandatory Checklist

- Confirm the Relay root with `git rev-parse --show-toplevel` before editing.
- Confirm the DSH checkout has only the official `origin` fetch URL and a disabled
  push URL.
- Confirm DSH `HEAD` is detached at `origin/master` after synchronization.
- Confirm `git -C upstream/deepseek-harness status --short` is empty before and
  after compatibility work.
- Do not stage, commit, tag, merge, rebase, or push from the DSH checkout.
- Confirm `git submodule status` matches the plugin commits intended by Relay.
- Commit and push plugin changes in the child repository before advancing a Relay
  submodule pointer.
- Keep plugin-to-plugin interaction on public DSH or capability contracts; a plugin
  must not import Relay parent source or another plugin package.
- Keep generated dependencies and build output ignored and out of Relay commits.
- Put every persistent implementation or compatibility change in Relay-owned paths.
- Record the exact official DSH commit used for compatibility claims.

If any item fails, stop and restore the repository boundary before continuing.
