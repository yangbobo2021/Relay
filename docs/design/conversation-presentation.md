# DSH Conversation Presentation Design

This design implements the
[DSH conversation presentation specification](../spec/conversation-presentation.md).

## Composition

`AdvancedDebugPreference` is a small browser store backed by
`relay.ui.advanced-debug`. It defaults to `false`, exposes a stable external-store
subscription, tolerates unavailable storage, and follows `storage` events from
other tabs.

The Relay DSH client contributes three additive pieces:

1. A native settings section containing the global switch.
2. A hidden marker in `conversation.session.header.actions`. In simple mode it
   selects DSH's first native view tab (`chat`) when necessary and marks the owning
   header so scoped CSS hides only that header's tab list.
3. A lower-priority occupant for the existing `session-log-download` utility cell
   while simple mode is active. DSH slot shadowing hides the native action without
   unregistering or replacing the exporting plugin. Enabling debugging disposes the
   shadow and immediately restores the original action.

No conversation body, header, view, composer, Trajectory renderer or log exporter is
reimplemented. Session event persistence and execution paths are untouched.

## Requirement Mapping

| Requirements | Implementation |
| --- | --- |
| `CPS-001`, `CPS-003` | Header marker CSS plus reversible Session-log slot shadow |
| `CPS-002`, `CPS-006` | Observable persisted preference and localized settings section |
| `CPS-004` | Native Chat tab selection before diagnostic tabs are hidden |
| `CPS-005` | Presentation-only client contributions; no Host or persistence changes |
