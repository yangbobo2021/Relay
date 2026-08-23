# External DSH Workbench

## Decision

Relay ships independently selectable external DSH plugins against an immutable
checkout of the official repository. Product features must not require a Fork or
patched DSH core.

This decision covers the two former Fork workstreams:

| Relay capability | External implementation | DSH dependency |
| --- | --- | --- |
| Codex conversations | Relay LLM adapter over Codex App Server | Agent and Session APIs |
| Claude conversations | Relay LLM adapter over Claude SDK/CLI | Agent and Session APIs |
| Workspace files | Relay Host gateway and Client view | DSH `fs` and client slots |
| Web terminal | Terminal plugin plus a Codex App Server provider | Cordis provider service |
| Workbench frame | Generic Workbench Client layout contribution | DSH root/occupant slot contracts |

## Why The Terminal Uses App Server

The Terminal plugin owns the browser surface, Typert Remote, bounded scrollback, and
provider registry. Codex App Server contributes process creation, PTY resize, input,
streamed output, and termination through `ctx.relayTerminalProviders`. This keeps the
terminal presentation reusable while the execution backend retains PTY authority.

The Typert gateway translates browser requests into the selected provider. Terminal
output is retained in a bounded Host scrollback buffer and read by polling, so DSH
does not need a plugin-specific Remote event allowlist. With no provider installed,
the plugin stays loadable and reports a contained unavailable state.

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
2. Build and pack each selected package independently.
3. Install the tarballs into a pristine official DSH profile.
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
