# DSH Conversation Presentation Specification

## Scope

This specification controls how Relay presents DSH conversations for every Agent
preset and model provider. It changes presentation only; DSH remains the owner of
the conversation, trajectory and diagnostic data.

## Requirements

- `CPS-001`: Advanced debugging defaults to off. A normal conversation must show
  one continuous Chat view without visible Chat/Trajectory tabs or a Session log
  download action.
- `CPS-002`: Settings must contain one global `Advanced debugging` switch under an
  `Advanced` section. The preference is browser-wide, applies to all Sessions and
  providers, and persists across reloads.
- `CPS-003`: Enabling advanced debugging must reveal DSH's existing Chat/Trajectory
  tabs and existing Session log download action. Relay must not clone or replace
  those native surfaces.
- `CPS-004`: Disabling advanced debugging while Trajectory is selected must first
  return the Session to Chat and then hide the diagnostic navigation. Reopening or
  switching back to the Session must not leave a blank or hidden Trajectory view.
- `CPS-005`: The preference must not delete Session events, disable Trajectory
  generation, alter model execution, or change Relay Event delivery. It controls
  only discoverability and the active view.
- `CPS-006`: The setting and its effects must update without a page reload and must
  survive Session switching. Chinese and English labels and an accessible switch
  name are required.

## Acceptance Boundary

Acceptance covers the off-by-default experience, immediate enable/disable behavior,
disable-from-Trajectory recovery, cross-Session behavior, reload persistence and
absence of new console errors in the native DSH Web application.
