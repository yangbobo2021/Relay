# Relay Events Plugin

`@relay/plugin-events` adds provider-neutral external Events, Waits, Monitors,
delivery, webhook ingress, agent tools, and event management to an unmodified
DeepSeek Harness profile.

It does not contain Codex, Claude, terminal, file-browser, or replacement layout
code. It attaches through DSH's root Agent lifecycle, so the same event mechanism
applies to standard DSH conversations and every installed execution backend.
It publishes ordinary DSH Agent tools and never imports or detects an execution
backend; compatible adapters consume the same public DSH tool contract.

```bash
dsh plugin --profile web add @relay/plugin-events
```

Build and verify from Relay:

```bash
npm run prepare:dsh
npm --workspace @relay/plugin-events run typecheck
npm --workspace @relay/plugin-events run build
npm run test:install:dsh-official
```

The integration is verified against official DSH commit
`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`; the official checkout remains
read-only.
