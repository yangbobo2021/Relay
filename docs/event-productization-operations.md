# Relay Event Productization Operations

Status: release operating guide. Every shell block in this document is executed,
unchanged, by scripts/verify-operations-docs.mjs in a clean temporary DSH home.
The release reference is official DSH 0.1.2-alpha.3 at
dd6322d604e00eec1ba5e0c8541159906a21094a.

## Prerequisites And Release Artifacts

Use Node 22 or newer and a prepared, clean official DSH checkout. Set the three
absolute paths below. RELAY_ARTIFACT_DIR must be an empty private directory.

<!-- relay-doc-test -->
~~~bash
: "${RELAY_REPOSITORY_ROOT:?Set RELAY_REPOSITORY_ROOT to the Relay checkout}"
: "${DSH_ROOT:?Set DSH_ROOT to the prepared official DSH checkout}"
: "${DSH_HOME:?Set DSH_HOME to a private DSH data directory}"
: "${RELAY_ARTIFACT_DIR:?Set RELAY_ARTIFACT_DIR to an empty artifact directory}"
cd "$RELAY_REPOSITORY_ROOT"
npm --prefix integrations/events run verify
npm --prefix integrations/monitors run verify
npm --prefix integrations/semantic-router run verify
npm --prefix integrations/github run verify
npm --prefix integrations/email run verify
mkdir -p "$RELAY_ARTIFACT_DIR"
npm pack ./integrations/events --ignore-scripts --pack-destination "$RELAY_ARTIFACT_DIR"
npm pack ./integrations/monitors --ignore-scripts --pack-destination "$RELAY_ARTIFACT_DIR"
npm pack ./integrations/semantic-router --ignore-scripts --pack-destination "$RELAY_ARTIFACT_DIR"
npm pack ./integrations/github --ignore-scripts --pack-destination "$RELAY_ARTIFACT_DIR"
npm pack ./integrations/email --ignore-scripts --pack-destination "$RELAY_ARTIFACT_DIR"
node scripts/verify-event-package-audit.mjs
~~~

Record the SHA-256 of all five tarballs. Release acceptance installs those exact
artifacts; it never imports a workspace source directory.

## Protected Configuration

Prefer the **Waiting events** UI for GitHub and Gmail credentials: the fields are
write-only, the screen never receives secret values, rotation takes effect without a
restart, and revoke is immediate. The Semantic Router provider/model are also
editable there when the DSH profile has a writable Settings provider. An environment
or composition value is treated as a deployment-owned fallback.

For a non-interactive deployment, export the values in the protected launch
environment. Do not paste production values into Git, support bundles, screenshots,
or shared shell history.

<!-- relay-doc-test -->
~~~bash
export RELAY_DATABASE_PATH="$DSH_HOME/private/relay-events.sqlite"
export RELAY_EMAIL_DATABASE_PATH="$DSH_HOME/private/relay-email.sqlite"
export RELAY_GITHUB_WEBHOOK_SECRET="release-test-github-secret-0123456789"
export RELAY_GITHUB_TOKEN="release-test-read-token-0123456789"
export RELAY_GMAIL_TOKEN="release-test-gmail-api-token-0123456789"
export RELAY_GMAIL_PUSH_TOKEN="release-test-gmail-push-token-0123456789"
# For direct authenticated Google Pub/Sub delivery, omit the fixed Push token and set:
# export RELAY_GMAIL_PUSH_AUDIENCE="https://relay.example.com/api/relay/email/gmail/push"
# export RELAY_GMAIL_PUSH_SERVICE_ACCOUNT="relay-push@example-project.iam.gserviceaccount.com"
export RELAY_ROUTER_PROVIDER="relay-acceptance"
export RELAY_ROUTER_MODEL="router"
export RELAY_LOCALE="zh-CN"
export RELAY_TIMEZONE="Asia/Shanghai"
mkdir -p "$DSH_HOME/private"
~~~

Use a project-scoped, read-only GitHub token. Configure GitHub to POST
pull_request, pull_request_review, check_run, check_suite, and workflow_run
to /api/relay/github/webhook. Configure Gmail watch to publish to a Cloud Pub/Sub
topic, and configure an authenticated push subscription to POST to
/api/relay/email/gmail/push. Its OIDC audience and service-account email must exactly
match Relay's deployment settings. A fixed Push token is only for a trusted gateway
that replaces Pub/Sub authentication before forwarding; Google Pub/Sub itself does
not send an arbitrary fixed Bearer token.

## Install And Diagnose

Initialize a fresh profile, then install the five packed bundles. dsh plugin
forwards add and remove to pnpm and reconciles the DSH bundle stack.

<!-- relay-doc-test -->
~~~bash
node "$DSH_ROOT/apps/cli/lib/bin.js" plugin --profile web install
node "$DSH_ROOT/apps/cli/lib/bin.js" plugin --profile web add \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-events-0.2.1.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-monitors-0.2.1.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-semantic-router-0.2.1.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-github-0.1.0.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-email-0.1.0.tgz"
node scripts/relay-doctor.mjs --locale zh-CN --timezone Asia/Shanghai --probe
node scripts/relay-doctor.mjs --json --probe > "$DSH_HOME/relay-doctor.json"
~~~

A non-zero doctor exit is release-blocking. JSON check IDs are stable and
locale-neutral; text status and remediation support en-US and zh-CN. --probe
uses an isolated temporary SQLite database, sends one synthetic Event through the
real ingress handler, proves one inbox admission, and deletes the probe storage. It
does not write to the configured production database.

The local scheduler cannot run while DSH is stopped or the computer is powered off.
Overdue timers and Monitors reconcile after the Host restarts. Without a notification
provider, escalations remain visible in Waiting events and doctor reports the
external notification capability as unavailable.

## Upgrade And Recovery

Stop DSH before copying the SQLite database and its -wal/-shm companions. Keep a
verified backup until the upgraded Host boots, doctor reports schema 9, and a
disposable probe passes. Reinstalling exact tarball paths updates the profile in
place:

<!-- relay-doc-test -->
~~~bash
node "$DSH_ROOT/apps/cli/lib/bin.js" plugin --profile web add \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-events-0.2.1.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-monitors-0.2.1.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-semantic-router-0.2.1.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-github-0.1.0.tgz" \
  "$RELAY_ARTIFACT_DIR/relay-dsh-plugin-email-0.1.0.tgz"
node scripts/relay-doctor.mjs --json --probe > "$DSH_HOME/relay-doctor-after-upgrade.json"
~~~

Relay migrates supported older schemas forward and refuses a database newer than the
running build. Never downgrade in place. On database_locked, stop the conflicting
Host and retry. On database_corrupt, retain the damaged files for diagnosis and
restore a verified backup. Deleting the database discards unresolved Waits and is not
a repair procedure.

## Rotate, Revoke, And Uninstall

GitHub zero-downtime rotation keeps the previous and new webhook secrets valid
together until the operator confirms the new delivery. Revoke then removes both
immediately. Gmail credential replacement writes API and push credentials as one UI
operation; a partial write rolls back. Disconnecting a mailbox deletes only its
incremental cursor after explicit confirmation.

Before uninstalling, stop or cancel active Monitors in Waiting events and retain the
database according to policy. Remove Connector and routing bundles before the runtime
bundles. Removal never authorizes deletion of Relay databases or audit evidence.

<!-- relay-doc-test -->
~~~bash
node "$DSH_ROOT/apps/cli/lib/bin.js" plugin --profile web remove \
  relay-dsh-plugin-email \
  relay-dsh-plugin-github \
  relay-dsh-plugin-semantic-router \
  relay-dsh-plugin-monitors \
  relay-dsh-plugin-events
~~~
