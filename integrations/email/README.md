# Relay Email Plugin

This plugin accepts authenticated Gmail push notifications, advances a durable Gmail
history cursor, fetches new messages through a read-only provider client, normalizes
bounded message evidence, and routes correlated threads through a trusted Events
binding. Uncorrelated messages use the configured Semantic Router.

Configure `RELAY_GMAIL_TOKEN` and a private `RELAY_EMAIL_DATABASE_PATH`. For direct
Google Cloud Pub/Sub delivery, also set `RELAY_GMAIL_PUSH_AUDIENCE` to the subscription
OIDC audience and `RELAY_GMAIL_PUSH_SERVICE_ACCOUNT` to its push-auth service account.
Relay verifies Google's RS256 signature, issuer, audience, service-account email,
verified-email claim, and bounded token lifetime against Google's cached JWKS.

`RELAY_GMAIL_PUSH_TOKEN` remains available for a trusted gateway that injects a fixed
Bearer token. Google Pub/Sub does not send an arbitrary fixed Bearer token, so direct
Pub/Sub delivery must use the OIDC configuration. Credentials are never returned,
persisted, or logged.

Alternatively, configure or revoke the Gmail API and gateway-token credentials
atomically from DSH Settings → Waiting events. Deployment-owned OIDC settings are
read-only in the UI. The same surface shows redacted connection state and lets users
pause, resume, or disconnect each mailbox. Cursor and lifecycle state survive Host
restart; expired history performs a bounded 500-message resync, while partial-page
failures keep the prior safe checkpoint. Concurrent push/poll overlap deduplicates by
Gmail message identity.

Normalized evidence covers plain text/HTML, Unicode, replies, forwards, BCC, quoted
history, lists, automated replies, delivery failures, and bounded attachment metadata.
Attachment content is never downloaded or executed.
