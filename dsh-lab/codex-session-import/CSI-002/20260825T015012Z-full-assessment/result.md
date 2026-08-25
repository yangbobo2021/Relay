# Result: CSI-002 / 20260825T015012Z-full-assessment

## Conclusion

Solved by native thread/resume. An exec-created Thread resumed with the same ID, retained compacted context, and continued across Codex 0.148 to 0.149.

Technical feasibility status: **verified**. Production implementation status: **not implemented**.

## Validated Solution

Bind the DSH Session to the original Thread ID and fail closed on resume errors; never create a silent replacement.

## Evidence

| Run | Outcome | Started | Completed |
| --- | --- | --- | --- |
| live-1 | pass | 2026-08-25T01:47:10.040Z | 2026-08-25T01:48:26.851Z |
| live-2 | pass | 2026-08-25T01:48:26.852Z | 2026-08-25T01:49:37.560Z |
| version-compat | pass | 2026-08-25T01:49:37.560Z | 2026-08-25T01:50:06.082Z |

## Gates

- PASS: Historical marker was readable
- PASS: Continuation recovered the marker
- PASS: contextCompaction required no DSH decoding
- PASS: cross-version resume passed

## Residual Limit

The result is valid for the recorded Codex, plugin, and official DSH versions. The import feature still has to implement this validated design and run its production acceptance suite.
