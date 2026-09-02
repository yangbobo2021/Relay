# Email Connector Test Review

Release evidence must separately prove cursor commit ordering and Events idempotency;
a successful HTTP return is not sufficient. The anti-false-pass mutation advances the
cursor before message handling and must make the partial-failure scenario fail.
Packed official DSH evidence records artifact hashes and zero skipped scenarios.

## Productization Review

- Email verification discovers 20/20 tests with zero skip/todo. Tests independently
  reopen the cursor database after a partial-page failure, prove the old cursor is
  used, and count unique durable message identities after push/poll overlap.
- Direct Pub/Sub authentication generates real RSA-signed JWTs, verifies them through
  the production JWKS path, proves cache reuse, and rejects forged signatures, wrong
  issuer/audience/service-account/verified-email claims, stale/future/overlong tokens,
  missing credentials, and unavailable key service before mailbox sync.
- The Host-wiring cases prove complete deployment settings select OIDC in management,
  reach the production HTTP handler, and establish the initial cursor; either missing
  half of the OIDC identity fails at startup.
- Expired and invalid cursor cases exercise bounded production resync; the one-over
  500 path remains degraded and cannot advance. The normalization matrix covers
  forward/BCC/list/automated/failure variants plus hostile HTML and attachment policy.
- Official DSH installs the packed Email/Events management composition and completes
  credential configure/revoke and mailbox pause/resume/disconnect in English and
  Chinese. Tokens are never rendered, returned in status, or stored in cursor rows.
- The cursor-order mutation described above remains the anti-false-pass criterion;
  HTTP 202 alone is never accepted as cursor or Delivery evidence.
- Replacing the production RSA verification result with an unconditional success made
  the forged-signature test fail with `Missing expected rejection`; the mutation was
  restored and 20/20 passed. This prevents a claim-only OIDC test from passing without
  executing signature verification.
