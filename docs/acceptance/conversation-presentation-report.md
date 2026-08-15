# DSH Conversation Presentation Acceptance Report

## Status

**PASS** on 2026-08-15.

The native DSH conversation now defaults to a single Chat presentation for all
providers. Trajectory navigation and Session log download remain available through
Settings > Advanced > Advanced debugging.

## Scenario Results

| Scenarios | Result | Evidence |
| --- | --- | --- |
| `CPA-001` - `CPA-002` | PASS | Chrome showed an existing Codex-backed Session with normal Chat content, zero visible tabs, zero Session log actions, and one unchecked accessible switch. |
| `CPA-003` | PASS | Enabling the switch immediately restored the native `对话` / `轨迹` tabs and one Session log button. |
| `CPA-004` | PASS | Trajectory was selected, then disabling the switch returned the same Session to its visible Chat transcript before diagnostics disappeared. |
| `CPA-005` | PASS | Reload preserved both enabled and disabled values; the setting is owned by one browser-wide preference source rather than a Session. |
| `CPA-006` | PASS | Review confirms the implementation changes client presentation only; runtime and timer unit regressions remain green. |
| `CPA-007` | PASS | Unit tests cover defaulting, persistence, storage failure tolerance, notifications, cross-tab changes and disposal. |

## Automated Evidence

- `npm test`: **54 passed, 0 failed**.
- DSH production client bundle, Session cold resume and runtime delivery experiments:
  **PASS**.
- Browser acceptance: **PASS** at `http://127.0.0.1:4317` in Chrome.

## Residual Regression Signal

`npm run experiment:dsh-timer` timed out waiting for the standalone timer probe's
third model request, including with the Web server stopped and a temporarily extended
15-second observation window. The timer's automated runtime test passes, and this
change modifies no Host, monitor, timer, inbox or persistence code. The failure is
therefore outside this presentation requirement, but remains recorded rather than
reported as a green full experiment suite.
