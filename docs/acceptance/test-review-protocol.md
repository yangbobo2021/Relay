# Delivery Test Review Protocol

Status: Required for Event Productization

Every small implementation change and every completed requirement receives two
separate reviews. A green command is evidence only after both reviews pass.

## Review A: Is The Delivery Coverage Sufficient?

The reviewer records answers to all applicable questions:

1. Which normative requirement and scenario IDs changed?
2. Does the test assert the user-visible outcome, not only an internal helper result?
3. Are success, refusal, retry, timeout, duplicate, restart, concurrency, stale state,
   authorization, size boundary, cleanup, and unavailable dependency covered where the
   change can affect them?
4. Does stateful behavior inspect durable intermediate and terminal records?
5. Does a UI change cover English, Chinese, keyboard, focus, accessibility semantics,
   viewport geometry, empty/loading/error/degraded states, and browser errors?
6. Does a protocol change use a real server/client boundary with raw bytes and headers?
7. Does a packaging/runtime change run from a clean installed tarball and supported
   official DSH profile?
8. Does restart behavior actually close and reopen the process/controller/database?
9. Are privacy and secret redaction checked in every output surface?
10. Could the tests all pass while a reasonable customer journey is still broken? If
    yes, add the missing scenario before accepting the change.

Review A fails when a required acceptance layer is replaced by a lower layer without a
documented reason and unchanged release status.

## Review B: Did The Tests Execute Correctly?

The reviewer records objective evidence for all applicable checks:

1. The exact candidate commit, tarball SHA-256, installed version, resolved entry path,
   DSH commit, command, exit code, duration, and artifact path are recorded.
2. Workspace imports, symlinks, stale build output, cached browser bundles, and an
   already-running wrong Host are rejected or positively identified.
3. Test discovery counts are asserted. Zero discovered tests, filtered tests, skipped
   tests, unavailable optional services, and early-return branches fail release runs.
4. Expected side effects are proven by independent observation: database rows, inbox
   message identity, provider request, browser DOM, process PID/restart, or audit record.
5. Expected absence is also asserted: no second Delivery, no new Session, no model call,
   no leaked secret, no console error, and no remaining lease where relevant.
6. Fake clocks advance the actual scheduler boundary; restart tests reopen state rather
   than reconstructing desired objects in memory.
7. Fault injection proves the target branch was reached and is reset after the test.
8. At least one mutation check is performed for new critical behavior: temporarily
   invert/remove the implemented guard or use a purpose-built negative fixture and show
   that the new acceptance assertion fails for the expected reason.
9. Screenshots are accompanied by DOM/geometry/locale assertions; visual evidence alone
   does not pass behavior.
10. Controlled-live prerequisites are verified before action and the final provider
    state/identity is recorded. A missing credential cannot silently convert a live test
    into a fake or skipped pass.

## Required Review Record

Review records live under `.artifacts/` during development and a sanitized summary is
committed under `docs/acceptance/` for a release. Each record contains:

```json
{
  "change": "short identifier",
  "requirements": ["EP-01"],
  "scenarios": ["EP01-001"],
  "coverage_review": { "result": "pass", "evidence": [] },
  "execution_review": { "result": "pass", "evidence": [] },
  "commands": [],
  "candidate": {},
  "negative_proof": {},
  "known_gaps": []
}
```

Any non-empty `known_gaps` entry must name scenarios that remain unreleased. It cannot
be converted to a warning while claiming the requirement is delivered.
