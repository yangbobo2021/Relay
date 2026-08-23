# External DSH Workbench

## Decision

Relay ships one external DSH plugin against an immutable checkout of the official
repository. Product features must not require a Fork or patched DSH core.

This decision covers the two former Fork workstreams:

| Relay capability | External implementation | DSH dependency |
| --- | --- | --- |
| Codex conversations | Relay LLM adapter over Codex App Server | Agent and Session APIs |
| Claude conversations | Relay LLM adapter over Claude SDK/CLI | Agent and Session APIs |
| Workspace files | Relay Host gateway and Client view | DSH `fs` and client slots |
| Web terminal | Relay gateway over App Server `command/exec` | Session workspace identity |
| Workbench frame | Relay Client layout contribution | DSH root/occupant slot contracts |

## Why The Terminal Uses App Server

The terminal belongs to the execution backend that owns the working context. Codex
App Server already exposes process creation, PTY resize, input, streamed output, and
termination. Using that protocol avoids changes to DSH terminal interfaces and keeps
the terminal aligned with Codex permissions and workspace selection.

Relay's Typert gateway translates browser requests into App Server calls. Terminal
output is retained in a bounded Host scrollback buffer and read by polling, so DSH
does not need a plugin-specific Remote event allowlist.

## Remaining Layout Exception

DSH currently exposes useful occupant slots but not a generic extension point for a
plugin-owned right panel and bottom panel. Relay therefore disables `ui-layout` in
its profile patch and supplies a compatible root frame. Official conversation,
sidebar, details, settings, and overlay occupants continue to render through their
existing slots.

This is an external replacement, not a core patch. The preferred upstream
contribution is a small set of generic frame slots. Once official DSH provides them,
Relay can stop replacing `ui-layout` and contribute only panel occupants.

## Update Workflow

1. Run `scripts/sync-dsh.sh` to fetch official `master` into the detached, read-only
   DSH checkout.
2. Build and pack `integrations/deepseek-harness` independently.
3. Install the tarball into a pristine official DSH profile.
4. Verify startup, conversation creation, file listing/preview, terminal spawn/input,
   desktop/mobile layout, and browser console errors.
5. Put compatibility shims in the Relay plugin. Upstream only generic APIs that are
   broadly reusable.

The former Fork and `codex/web-workbench-surfaces` branch are not installation,
development, or update bases.

## Verified Baselines

- Official source: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
  (`0.1.1-rc.2`, reviewed 2026-08-22).
- Public packaged runtime: DSH `0.1.0-rc.8`, with Relay file and terminal workflows
  exercised in Chromium.
- Source origin: the official `deepseek-ai/deepseek-harness` repository only.
