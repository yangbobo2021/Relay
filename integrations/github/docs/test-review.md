# GitHub Test Review

Every release run must record both reviews required by Relay's root
`docs/acceptance/test-review-protocol.md`.

Review A checks persistence absence on rejected protocol inputs, exact normalized
fields, authoritative binding owner, unchanged-poll absence, atomic baseline failure,
and redaction. Review B requires packed install identity, zero skipped tests, actual
official DSH boot, an HMAC mutation that makes GIT-001 fail, and independent database
or inbox evidence rather than handler return values alone.

## Implementation Review 1

- GitHub source tests discovered 13/13 with zero skip/todo. Events 36, Semantic
  Router 10, Monitors 10, GitHub 13, and real composition 12 all passed together.
- The composition test uses real SQLite Events state and the real Monitors provider:
  baseline produces no inbox admission; one changed canonical fingerprint produces
  exactly one Delivery to the original Session with the committed continuation.
- The signed webhook composition uses the real bound-source capability. Replaying the
  same delivery leaves inbox count at one; changed content with the same delivery ID
  returns 409 and still leaves inbox count at one.
- Official DSH `dd6322d604e00eec1ba5e0c8541159906a21094a` installed packed Events,
  Monitors, and GitHub artifacts into a pristine profile. The GitHub artifact SHA-256
  was `e80f6ec2804129eb0c887af66a94874fef8bcc0e865a1e8ce7f4a7ab746aaa3f`.
  The running Host accepted a correctly signed unsupported Event, durably dismissed
  it, recognized its replay, rejected an invalid signature, and loaded the browser
  without console/runtime errors.
- Mutation proof initialized signature matching as successful. EP04-003 failed
  (`500 !== 401`) instead of passing the invalid-signature matrix. Restoring the
  comparison made the targeted test pass, proving the rejection test traverses the
  production signature guard.

## Implementation Review 2

- GitHub verification now discovers 21/21 tests with zero skip/todo and packs the
  production artifact. A real local HTTP server proves multi-page check/review
  collection, exact 5-page/500-item bounds, and hostile continuation rejection.
- Project-policy tests cover path-prefix collisions, longest nested roots,
  repository allowlists, per-project credential lookup, missing/forged durable
  scopes, and absence of global/cross-project fallback. Durable records contain only
  opaque `project_scope` IDs.
- The official DSH browser completes configure, rotate/overlap, status, revoke, and
  post-revoke HTTP rejection in English and Chinese with credential redaction and no
  console/runtime errors. Webhook/poll ordering converges through the production
  correlation key in real Events/Monitors composition.
- Controlled-live GitHub against an external repository is a separate environment
  gate and is not fabricated from the provider-compatible HTTP suite.

## Implementation Review 3 — Bundle extension boundary

- GitHub verification discovers 24/24 tests with zero skip/todo and packs version
  `0.2.0` against Monitor Core `0.3.0`; dependency resolution must reject the old
  Core instead of using a forced install.
- Registry tests prove bilingual metadata, authorized hiding, live
  `configuration_required` to `available` health, and provider-owned factory output.
- Detection tests invoke the GitHub provider's production detector, assert the
  declared Event/key/correlation output, and prove unchanged observations emit none.
- Root SQLite composition uses the new provider/detector identity and still proves
  polling/webhook dedupe. External-account certification remains separate and is not
  fabricated from deterministic provider evidence.

## Implementation Review 4 — migration and final official profile

- A real-file migration test stores the legacy `github` observer and
  `snapshot_changed` detector, records the original PR baseline, closes Events and
  Monitors, then reopens the same SQLite file through the extension-owned alias.
  The original Monitor/Wait/version, stable subject, fingerprint, continuation, and
  Session are asserted before a check transition emits the original canonical
  correlation key.
- The final GitHub suite discovers 24/24 tests with zero skip/todo. Official DSH
  installs the artifact recorded by the external root acceptance report and completes
  the packed bilingual browser/configuration matrix.
