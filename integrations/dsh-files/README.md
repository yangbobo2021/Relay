# Relay DSH Files Plugin

`@relay/dsh-plugin-files` contributes a workspace explorer to the side region of
`@relay/dsh-plugin-workbench`. Its Host Remote uses DSH Agent identity and filesystem
services, enforces workspace containment, and bounds UTF-8 text previews.

```bash
dsh plugin --profile web add @relay/dsh-plugin-workbench @relay/dsh-plugin-files
```

The plugin has no Codex, Claude, or Events dependency.
