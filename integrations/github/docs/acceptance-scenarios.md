# GitHub Delivery Acceptance Scenarios

| ID | Scenario | Required evidence |
|---|---|---|
| GIT-001 | Valid raw-body HMAC persists a supported normalized transition before HTTP 202. | protocol + SQLite |
| GIT-002 | Missing, malformed, wrong, mutated, and old revoked signatures persist nothing. | protocol security |
| GIT-003 | Five supported GitHub event families preserve stable PR/SHA/action/outcome evidence. | fixture matrix |
| GIT-004 | Provider replay is idempotent; conflicting delivery-ID reuse returns 409. | Events composition |
| GIT-005 | One matching artifact uses trusted binding; zero or ambiguous matches never select the first Session. | service composition |
| GIT-006 | Unsupported signed event becomes an inspectable dismissal. | protocol + SQLite |
| GIT-007 | Body, content type/encoding, nesting, key count, and request rate boundaries fail before persistence. | resource security |
| GIT-008 | Canonical API observations ignore array order and volatile response metadata. | provider fake |
| GIT-009 | Authentication, permission, rate, not-found, 5xx, malformed, network, and cancellation errors use stable redacted classes. | provider fake |
| GIT-010 | Root-Agent workflow atomically stores Wait, continuation, baseline, Monitor, and next check; invalid inputs preserve the old phase. | official DSH + SQLite |
| GIT-011 | Unchanged polling creates no Event/model turn; one changed fingerprint emits one bound transition. | Monitors composition |
| GIT-012 | Packed plugin installs and boots with Events and Monitors in pristine official DSH. | packed official DSH |
| GIT-013 | Checks and reviews traverse real multi-page HTTP responses, stop at 5 pages/500 items, and reject hostile cross-origin/path `Link` targets without token forwarding. | local HTTP provider protocol |
| GIT-014 | Redirect, moved, deleted, unavailable, canonical identity change, and malformed/non-JSON responses map to distinct stable redacted classes. | provider fault matrix |
| GIT-015 | Longest path-boundary project policy authorizes only its repository allowlist and persists only an opaque project scope. Prefix collisions and missing policies fail closed. | policy unit + SQLite |
| GIT-016 | Each project resolves its own DSH credential handle; forged/missing durable scopes and cross-project fallback cannot use a global or sibling token. | credential/provider composition |
| GIT-017 | Configure, rotate with overlap, revoke, status, and post-revoke rejection are fully usable in English and Chinese without rendering a secret. | official DSH browser + HTTP |
| GIT-018 | Webhook and polling observations for one canonical transition converge to one Event/Delivery regardless of order. | Events/Monitors race composition |
