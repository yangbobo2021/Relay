# CSI-014: App Server Protocol Compatibility

## Record

- Priority: P0
- Status: verified
- Current conclusion: required import methods are compatible across tested Codex 0.148 and 0.149 schemas
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-014/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-014/`

## Risk

Codex App Server may change `thread/list`, `thread/resume`, pagination, Thread fields,
or item shapes. Import can silently omit data or fail after a Codex update.

## Risk Reproduction

Capture sanitized protocol fixtures from the current and previous supported Codex
versions for successful, empty, paginated, archived, malformed, and not-found cases.
Run the import inventory and resume parsers against every fixture with unknown fields
added and optional fields removed.

Required data: versioned JSON fixtures, JSON shape summaries, parser results, warning
records, and exact CLI/App Server versions. Fixtures must exclude conversation text and
opaque encrypted content.

Pass condition: the supported protocol surface is explicit, unknown additive fields
are tolerated, and missing required fields fail with a stable diagnostic.

## Solution Direction

Add startup capability detection, narrow runtime validation at the import boundary,
pagination guards, and version-pinned contract fixtures. Disable import while leaving
ordinary Codex Sessions available when only the import capability is incompatible.

## Solution Validation

Run contract tests against both fixture versions and live supported App Servers.
Mutate each required field and response envelope in a negative-test generator.

Solution gate: all supported versions pass, malformed responses cannot produce a
partial successful import, and incompatibility is isolated to the import feature.
