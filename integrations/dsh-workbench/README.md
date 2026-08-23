# Relay DSH Workbench Plugin

`@relay/dsh-plugin-workbench` replaces the official DSH root layout through a
bundle patch and republishes the official sidebar, conversation, details, and
overlay seats. It adds generic keyed `side` and `bottom` view regions plus the
versioned `ctx.workbench` registry.

The package contains no built-in feature view. Install feature packages beside it:

```bash
dsh plugin --profile web add @relay/dsh-plugin-workbench @relay/dsh-plugin-files
```

When DSH exposes equivalent generic panel slots upstream, this plugin can stop
replacing `ui-layout` without changing feature view contracts.
