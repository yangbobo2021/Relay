# Repository Workflow Specification

## Purpose

Relay and DeepSeek Harness have separate Git histories. This specification keeps
local development, downstream maintenance, upstream synchronization, and possible
future contributions consistent across human and Agent work.

## Repository Boundaries

The repository root is the Relay repository. Relay product code, DSH adapters,
compatibility notes, and reproducible probes belong here.

`upstream/deepseek-harness/` is an ignored nested checkout of DeepSeek Harness. DSH
source changes are committed only in that repository. Relay secrets, customer data,
databases, generated logs, and private product code must never enter it.

## DSH Remotes And Durable Branches

The DSH checkout uses these remote roles:

- `upstream`: `https://github.com/deepseek-ai/deepseek-harness.git`, the official
  source used for fetch and synchronization;
- `origin`: `git@github.com:yangbobo2021/deepseek-harness.git`, the writable fork.

The durable branches have fixed responsibilities:

- `master` mirrors `upstream/master`. It receives no Relay-specific or other custom
  commits and must not be force-pushed, rebased after publication, or deleted.
- `relay/main` is the long-lived self-use integration branch. Accepted local features
  are merged into it. Published history is not rebased or force-pushed, and the
  branch must not be deleted.
- `codex/*` branches contain focused changes. They may be rebased onto
  `upstream/master` and force-pushed only with `--force-with-lease`.

The fork's `master` remains clean even if an upstream contribution is rejected.
Rejected or downstream-only work continues through `relay/main` without changing
the meaning of `master`.

## Local Development

New DSH work starts from the branch that owns its intended lifetime:

1. Fetch `upstream` and create a focused `codex/*` branch from the required official
   revision or from an explicitly documented dependent feature branch.
2. Keep independent behavior in independent commits. Shared prerequisites precede
   their consumers.
3. Include tests and affected package documentation with the behavior they verify.
4. Record the tested official DSH commit in Relay compatibility notes.
5. Push feature branches to `origin`; never push development commits to `upstream`.

Generated bundles, dependency directories, local state, editor files, temporary QA
artifacts, and screenshots with machine-local references are not source commits.
Useful QA evidence is sanitized, moved under an owned documentation directory, and
committed separately from implementation.

## Synchronizing Official Updates

Synchronization requires a clean worktree.

1. Fetch `upstream`.
2. Fast-forward local `master` to `upstream/master`; a non-fast-forward result is an
   invariant violation that must be investigated instead of forced through.
3. Push the updated `master` to `origin`.
4. Merge `upstream/master` into `relay/main`, resolve conflicts, run affected checks,
   and push `relay/main` to `origin`.
5. Rebase short-lived `codex/*` contribution branches onto `upstream/master` when a
   clean upstream comparison is required.

Long-lived `relay/main` uses merge for official updates so published downstream
history remains stable. Short-lived `codex/*` branches may use rebase because
their purpose is a clean review range.

## Upstream Contributions

Before preparing a pull request, read the latest official `CONTRIBUTING.md` and
repository instructions. At the DSH revision initially evaluated by Relay, external
pull requests are not accepted; this policy may change and must be verified rather
than assumed.

An upstream pull request uses a clean `codex/*` branch based on current
`upstream/master`. It contains only the commits needed by that contribution and no
Relay-only integration, private information, generated output, or unrelated cleanup.
The pull request targets `deepseek-ai/deepseek-harness:master` from the corresponding
branch in `yangbobo2021/deepseek-harness`.

If upstream accepts the change, synchronize `master` normally and retire the feature
branch only after verifying the accepted behavior is present. If upstream declines
or does not accept pull requests, merge the reviewed feature into `relay/main` and
maintain it as downstream work.

## Mandatory Checklist

Run this checklist before DSH commits, synchronization, pull requests, and branch
deletion. A failed item stops the operation.

- Confirm repository identity with `git rev-parse --show-toplevel`; do not confuse
  Relay with the nested DSH checkout.
- Inspect `git status --short --branch`, `git branch -vv`, and `git remote -v`.
- Confirm `origin` is the writable fork and `upstream` is the official repository.
- Confirm custom work is not being committed on `master`.
- Confirm staged files contain one intended change and exclude secrets, private Relay
  code, generated bundles, dependency directories, local databases, logs, editor
  files, and temporary QA output.
- Run `git diff --cached --check`, affected tests, type checks, and repository-required
  documentation or packaging checks before pushing.
- Before synchronizing, require a clean worktree and fast-forward only `master`.
- Before rebasing or force-pushing, require a short-lived `codex/*` branch and use
  `--force-with-lease`; never rewrite `master` or `relay/main`.
- Before deleting a branch, confirm it is neither `master` nor `relay/main`, its work
  is reachable from an accepted destination or has an explicit retained backup, and
  no open pull request or active worktree still uses it.
- Before opening a pull request, re-read current upstream contribution policy and
  verify the exact base repository, base branch, head fork, and head branch.

Branch protection is a repository invariant, not cleanup preference. Automation must
not delete or rewrite a durable branch merely because it appears merged or inactive.
