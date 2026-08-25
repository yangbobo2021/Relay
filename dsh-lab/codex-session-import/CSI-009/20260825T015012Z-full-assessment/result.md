# Result: CSI-009 / 20260825T015012Z-full-assessment

## Conclusion

Solvable with stable provenance keys. Reprojection appended zero duplicates and an incremental source turn appended only two messages.

Technical feasibility status: **verified**. Production implementation status: **not implemented**.

## Validated Solution

Key projections by Thread, Turn, item, and projection kind; persist those IDs in DSH messages or an import ledger.

## Evidence

| Run | Outcome | Started | Completed |
| --- | --- | --- | --- |
| pure-1 | pass | 2026-08-25T01:47:08.528Z | 2026-08-25T01:47:08.593Z |
| pure-2 | pass | 2026-08-25T01:47:08.595Z | 2026-08-25T01:47:08.657Z |
| dsh-1 | pass | 2026-08-25T01:47:08.657Z | 2026-08-25T01:47:09.371Z |
| dsh-2 | pass | 2026-08-25T01:47:09.371Z | 2026-08-25T01:47:10.039Z |

## Gates

- PASS: First projection appended four
- PASS: retry appended zero
- PASS: incremental projection appended two
- PASS: cold resume added no duplicates

## Residual Limit

The result is valid for the recorded Codex, plugin, and official DSH versions. The import feature still has to implement this validated design and run its production acceptance suite.
