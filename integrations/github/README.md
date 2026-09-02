# Relay GitHub Plugin

Relay's GitHub plugin verifies signed webhooks, normalizes pull-request transitions,
provides a read-only pull-request Monitor observer, and adds the authenticated root
Agent operation `relay_watch_github_pull_request`.

Configure `RELAY_GITHUB_WEBHOOK_SECRET` (minimum 16 characters) and optionally
`RELAY_GITHUB_TOKEN`. GitHub should send webhooks to
`/api/relay/github/webhook`. The API token needs read access to the configured
repository, pull requests, checks, and reviews.

The plugin never accepts a Session ID from tool input, never logs or returns either
secret, and never performs a GitHub write operation.

DSH Settings → Waiting events shows webhook/API health and supports safe secret
rotation with current/previous overlap and immediate revoke. Secrets remain
write-only and redacted. For multi-project hosts, configure `projects` with an
absolute `root`, repository allowlist, and DSH credential handle; Relay selects the
longest real path boundary and never falls back to another project's token.

Read-only API observation follows checks/reviews pagination up to five pages or 500
items and blocks cross-origin/path continuation links. Repository moved, deleted,
unavailable, and identity-changed states are distinct actionable failures.
