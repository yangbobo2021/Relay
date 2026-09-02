# Monitor Author DSH Plugin Specification

Status: normative

## Product boundary

`relay-dsh-plugin-monitor-author` is a DSH host plugin and bundled Skill provider.
It is not a Codex plugin, backend adapter, Monitor runtime, or capability provider.

When loaded, the plugin registers exactly one DSH Skill named
`relay-monitor-author` through `ctx.skills`. DSH's standard Skill catalog, `skill`
tool, and explicit `/relay-monitor-author` gesture own discovery and loading. The
plugin must not install files into Codex, mutate a project, or add its own model
backend.

The Skill creates Monitors only through the public tools supplied by
`relay-dsh-plugin-monitors` and optional capability plugins. Those tools derive the
owner from the current DSH root Agent and expose no caller-selected Session. The
Author plugin contains no direct Monitor storage or privileged creation path.

## Lifecycle

The Skill is model- and user-invocable, is visible in English and Simplified
Chinese, and includes an immutable package resource directory. Loading returns the
exact packaged instructions and no credentials or environment-derived content.

Hot unload removes only this provider's Skill catalog entry. Existing Monitor,
Wait, Event, and Delivery records remain owned by their runtime plugins. A missing
Monitor tool or capability must result in a failed creation, never a success claim.

## Packaging

The npm artifact must contain its DSH bundle patch, host entrypoint, Skill body,
reference resources, bilingual READMEs, specification, and acceptance documents.
It must contain no `.codex-plugin` manifest, install script, workspace import,
private path, secret, database, or generated runtime residue.
