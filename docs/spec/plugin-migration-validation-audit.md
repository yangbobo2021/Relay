# Plugin migration validation audit

Audit date: 2026-08-29

## Structural coverage

| Plugin | Requirements | Cases | Run directories | Unique result IDs | Extra reviewed runs | Missing case/result | Unfinished state |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Codex | 76 | 76 | 81 | 76 | 5 | none | 0 |
| Claude | 86 | 86 | 86 | 86 | 0 | none | 0 |
| Total | 162 | 162 | 167 | 162 | 5 | none | 0 |

Codex's five extra rows are retained reruns for `CDX-TXT-001`, `CDX-TXT-005`, `CDX-TOOL-009`,
`CDX-TOOL-013` and `CDX-TOOL-015`. They do not create duplicate requirements.

## State and product classification reconciliation

| Plugin | Catalog verified | Catalog failed | Product supported | Product partial | Product unsupported |
| --- | ---: | ---: | ---: | ---: | ---: |
| Codex | 61 | 15 | 59 | 6 | 11 |
| Claude | 80 | 6 | 78 | 3 | 5 |

The two classifications intentionally differ. Requirement state records whether the validation verdict is complete;
product classification records whether a user task can complete. Thus `CDX-FILE-002`, `CLD-FILE-002` and
`CLD-SES-004` have verified explicit-gap/rejection results but remain unsupported user capabilities.

## Final self-review

- Every requirement ID occurs in one primary case and at least one run-result row.
- No requirement remains `draft`, `ready` or `blocked`.
- Partial/unsupported IDs are disjoint and all exist in their owning requirement catalog.
- Supported counts are the exact catalog complement of partial+unsupported IDs.
- SDK/CLI applicability is not conflated: Claude live results use SDK; CLI has a separate conservative report.
- Retained fixture data is sanitized, validation settings were restored, and no result archives real secrets.
- `git diff --check` passes after the final report edits.
- Claude's complete direct test body passes 82/82. The `npm test` wrapper cannot run its `prepare:dsh` pre-step
  because the immutable local upstream checkout lacks installed pnpm peers; no test begins in that wrapper path.

## Reproduction logic

The audit enumerates `requirements.md` table IDs, primary case files and every `runs/*/results.md` row; it then
asserts the expected counts, zero unfinished states, complete set equality and the declared classification sums.
The immutable per-item method/evidence/review records remain the authority for each verdict.
