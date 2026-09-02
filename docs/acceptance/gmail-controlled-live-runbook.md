# Gmail Controlled-Live Acceptance Runbook

This optional deployment-certification runbook closes EP15-011 against a disposable
mailbox and Google Cloud project. EP15-011 does not block Relay publication because
preparing the external Google control plane costs more than the incremental evidence
justifies for the release candidate; it should be run during the first real Gmail
deployment or after a material Gmail/Pub/Sub compatibility change. It must use freshly
packed Relay artifacts in official DSH, a real Gmail `watch`, an
authenticated Pub/Sub push subscription, one sanitized reply, and an actual Pub/Sub
redelivery. A direct POST assembled by the test runner is not provider evidence.

## User-Supplied Prerequisites

- A disposable Gmail mailbox and permission to read it during the run.
- A Google Cloud project with billing/organization policy that permits Gmail API,
  Pub/Sub, service-account creation, and public HTTPS push delivery.
- A Desktop OAuth client created in that same project. Its Gmail user authorization
  must include `https://www.googleapis.com/auth/gmail.readonly`; write the resulting
  short-lived access token to a local mode-0600 file or protected environment source,
  never to chat, Git, screenshots, or this document.
- A locally authenticated Google Cloud CLI principal with permission to create/delete
  the disposable topic, push subscription, and push-auth service account, grant the
  required IAM roles, and seek the subscription for one redelivery. A service-account
  key stored in a local mode-0600 file is an alternative; do not paste it into chat.
- One quiet seed email thread in the disposable mailbox and permission to send one
  sanitized reply such as `Relay EP15-011 reply 中文 ✅`. The sender may be the user or
  another disposable account; Relay's Gmail credential remains read-only.

The Relay operator does not need a production domain for this controlled run. A
temporary HTTPS tunnel may expose a fixed loopback port and is removed with all
temporary Google resources after evidence is recorded.

## Provider Setup Contract

Create a disposable Pub/Sub topic, grant
`gmail-api-push@system.gserviceaccount.com` `roles/pubsub.publisher` on that topic,
and create a push-auth service account. The subscription must:

- push to the temporary public URL ending in `/api/relay/email/gmail/push`;
- use that URL as its OIDC audience;
- sign as the configured push-auth service account;
- retain acknowledged messages long enough for the controlled seek/redelivery; and
- use a bounded retry policy.

The Pub/Sub service agent needs `roles/iam.serviceAccountTokenCreator` on the
push-auth service account, and the configuring principal needs permission to act as
that service account. Call Gmail `users.watch` with the disposable topic. A successful
watch immediately emits the notification that establishes Relay's initial cursor.

## Packed Relay Run

Start the tunnel and export protected values locally. The coordination directory must
be private and disposable.

```bash
export DSH_ROOT='/absolute/path/to/official/deepseek-harness'
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export RELAY_CONTROLLED_WEB_PORT='60889'
export RELAY_GMAIL_TOKEN="$(< /private/path/gmail-access-token)"
export RELAY_GMAIL_PUSH_AUDIENCE='https://temporary.example/api/relay/email/gmail/push'
export RELAY_GMAIL_PUSH_SERVICE_ACCOUNT='relay-ep15@example-project.iam.gserviceaccount.com'
export RELAY_CONTROLLED_GMAIL_ACCOUNT='disposable@example.com'
export RELAY_CONTROLLED_GMAIL_THREAD_ID='provider-thread-id'
export RELAY_CONTROLLED_GMAIL_READY_FILE='/private/tmp/relay-gmail/ready.json'
export RELAY_CONTROLLED_GMAIL_BASELINE_FILE='/private/tmp/relay-gmail/baseline.json'
export RELAY_CONTROLLED_GMAIL_DELIVERY_FILE='/private/tmp/relay-gmail/delivery.json'
export RELAY_CONTROLLED_GMAIL_REDELIVERY_FILE='/private/tmp/relay-gmail/redelivery-started.json'
node scripts/verify-dsh-official-install.mjs --gmail-controlled-live
```

After `ready.json` appears, call Gmail `users.watch`. Do not send the reply until
`baseline.json` proves the immediate provider notification established a healthy
cursor without mailbox replay. Send the single sanitized reply, then wait for
`delivery.json`.

Seek the retained Pub/Sub subscription to a timestamp immediately before that reply,
then create `redelivery-started.json`. The fixture does not trust this marker as proof:
it waits for a second durable cursor update after the seek and still requires exactly
one new Event, Delivery, Activation, and Relay input in the intended existing Session.

## PASS Evidence And Cleanup

PASS requires `AUDIT_RESULT ... ok:true` plus the packed artifact hashes, official DSH
commit, redacted mailbox/thread target, Event/Delivery/Activation IDs, one Relay input,
second cursor update, and `redelivery_deduplicated:true`. The official DSH checkout
must remain clean.

Finally call Gmail `users.stop`, delete the disposable subscription/topic/service
account and temporary OAuth grant where appropriate, stop the tunnel, delete the
coordination directory and token file, and confirm no secret fragment appears in
Relay output or captured UI artifacts.
