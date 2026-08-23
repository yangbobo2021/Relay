# Relay DSH Terminal Plugin

`@relay/dsh-plugin-terminal` contributes an xterm-based bottom view to
`@relay/dsh-plugin-workbench`. It owns the browser Remote, bounded Host scrollback,
and versioned `ctx.relayTerminalProviders` registry. Execution backends contribute
PTY transports through that Cordis service.

```bash
dsh plugin --profile web add @relay/dsh-plugin-workbench @relay/dsh-plugin-terminal @relay/dsh-plugin-codex
```

Without a provider the plugin still loads and reports terminal unavailability when
a user tries to spawn a session.
