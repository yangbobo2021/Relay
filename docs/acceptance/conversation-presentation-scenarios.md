# DSH Conversation Presentation Acceptance Scenarios

| ID | Acceptance scenario | Requirements | Evidence |
| --- | --- | --- | --- |
| `CPA-001` | A fresh/default browser shows Chat content with no view tabs or Session log action | `CPS-001` | Automated + Browser |
| `CPA-002` | Settings exposes one localized, accessible Advanced debugging switch and it defaults off | `CPS-002`, `CPS-006` | Automated + Browser |
| `CPA-003` | Enabling the switch immediately restores native Chat/Trajectory tabs and Session log download | `CPS-003` | Browser |
| `CPA-004` | Disabling from the selected Trajectory view returns to visible Chat content and hides both diagnostics | `CPS-004` | Browser |
| `CPA-005` | Enabled and disabled values both survive reload and apply across Session switches/providers | `CPS-002`, `CPS-006` | Automated + Browser |
| `CPA-006` | Toggling changes no persisted Session events, execution route, or Relay delivery behavior | `CPS-005` | Review + Regression |
| `CPA-007` | Preference storage failures fall back to an in-memory setting; other-tab changes are observed | `CPS-002` | Automated |
