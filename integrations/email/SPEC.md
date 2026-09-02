# Relay Email Connector Specification

Status: Gmail provider-compatible baseline

The connector owns authenticated push handling, durable incremental history cursor,
read-only Gmail retrieval, bounded MIME normalization, and reliable provider-thread
binding. Events owns Event idempotency, semantic fallback, routing, and Delivery.

- A new account establishes a cursor without replaying the entire mailbox.
- Cursor advancement occurs only after every retrieved message has reached durable
  Events handling. A partial failure leaves the old cursor so replay can recover;
  provider message IDs prevent duplicate Delivery.
- History pagination is bounded. Partial-page provider failures preserve the prior
  checkpoint across process restart. Expired/invalid cursors enter a visible degraded
  state, perform a bounded recent-message resync (maximum 500), and advance only after
  every resynced Event is durable; over-limit resync leaves the old cursor intact.
- Plain text is preferred; HTML is converted to bounded text. Headers, recipients,
  quoted/thread evidence, and attachment metadata are bounded. Attachments are never
  downloaded or executed by this baseline; executable types are labeled blocked.
- Exactly one active `email_thread` artifact may create a trusted binding. Missing or
  ambiguous correlation uses ordinary Events routing and never selects the first
  Session.
- Direct Google Pub/Sub push verifies the Google-signed OIDC JWT against cached JWKS,
  exact issuer/audience/service-account identity, verified-email claim, and bounded
  issue/expiry times. A fixed shared Push token is supported only for a trusted
  gateway deployment. Push and API credentials remain in protected configuration.
  Public output and stored cursor records contain no credentials or raw message bodies.
- DSH Settings supports atomic credential configure/revoke plus per-account pause,
  resume, and disconnect. Lifecycle state survives restart; paused accounts reject
  sync and disconnected accounts remove only their cursor.
- Concurrent push and poll reads converge by provider message identity and commit a
  monotonic final cursor without duplicate Event or Delivery.
