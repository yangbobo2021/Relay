# Relay Monitor Author

DeepSeek Harness plugin that contributes the `relay-monitor-author` Skill to DSH's
native Skill catalog. The Skill guides the current DSH Agent through live Monitor
Bundle discovery, plugin preference, least-authority custom authoring, validation,
and durable installation.

Install this package together with `relay-dsh-plugin-monitors`. DSH users can ask
the Agent to wait for an external condition, load the Skill through DSH's native
Skill UI/tool, or invoke `/relay-monitor-author` explicitly. The Skill uses the
Monitor tools already scoped to the current DSH root Session; it does not create a
Codex plugin and does not bypass Relay authorization.

Unloading this plugin removes the Skill from new DSH catalog observations. It does
not stop or rewrite Monitors that were already committed by Monitor Core.

See [SPEC.md](SPEC.md) and [docs/acceptance-scenarios.md](docs/acceptance-scenarios.md).
