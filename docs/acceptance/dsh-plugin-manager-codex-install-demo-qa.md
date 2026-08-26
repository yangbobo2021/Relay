# DSH Plugin Manager Codex Install Demo QA

Recorded and accepted on 2026-08-26 against an isolated DSH profile and the
unmodified official DeepSeek Harness checkout at commit
`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

## Live Scenario

- DSH model: `DeepSeek-V4-Flash / High`.
- Plugin Manager: `relay-dsh-plugin-manager@0.1.0-rc.2` from npm `next`.
- Search request: exact discovery of `relay-dsh-plugin-codex` without installing.
- Search result: npm package `relay-dsh-plugin-codex@0.1.2` and GitHub source at
  commit `56324ecd9f2df4c172af2967fb347517d0770270`.
- Installation boundary: the manager produced a plan without changing state,
  then executed only after a separate explicit confirmation message.
- Final status: `succeeded`, package version `0.1.2`, activated `true`, enabled,
  entry ID `relay-codex-host`, and `restartRequired: true`.

The recording used a fresh temporary DSH home and a temporary demo workspace.
No local package link, tarball, or workspace source supplied the installed Codex
plugin. A separate live acceptance run also passed npm and GitHub discovery,
integrity checks, and the install/disable/enable/update/remove lifecycle before
the recording.

## Event-Aware Edit

The 74.85-second primary source and 5.85-second post-install proof clip were kept
outside the repository. The accepted 37.80-second edit retains every meaningful
interaction package while removing only model waits:

| Source interval | Evidence retained |
| --- | --- |
| `12.5-20.5` | `/plugins` selection, exact search text, submission, and search tool start |
| `25.5-31.5` | Exact npm and GitHub search result |
| `43.0-47.5` | Install-plan request with the explicit “do not execute” constraint |
| `49.0-56.0` | Plan result, package/version, restart expectation, and confirmation boundary |
| `63.5-70.5` | Separate confirmation and real execute/status tool calls |
| proof `0.3-5.6` | Stable final `succeeded` result with package name and version |

No visible typing, click, submission, state change, or readable result was
removed from a retained interaction package.

## Media QA

| Artifact | Properties | SHA-256 |
| --- | --- | --- |
| `dsh-plugin-manager-codex-install-demo.mp4` | 37.80 s, H.264 High, 1280x720, 30 fps, yuv420p, faststart, no audio | `95cb8b22e510229018bfb5a40b717498f5a0af2e371ba5460ac2e04be6559fbe` |
| `dsh-plugin-manager-codex-install-success.png` | 1280x720 RGB poster extracted at 36.5 s from the accepted MP4 | `c3a2a06adce91d897be2ae23778a7669988ab2f8320dc8de731854fd146b8a41` |

- Full ffmpeg decode completed for all 1,134 frames without an error.
- Black-frame detection with a 0.5-second threshold found no black interval.
- First, midpoint, last-frame, and 2-second contact-sheet inspection passed.
- The first interaction visibly enters the exact plugin search; the midpoint
  preserves the plan-only boundary; the final frame visibly shows `succeeded`,
  `relay-dsh-plugin-codex`, and npm version `0.1.2`.
- The final interface also visibly identifies the official DSH build as
  `b150a55` and the selected model as `DeepSeek-V4-Flash / High`.
- No API key, token, local username, host name, private filesystem path,
  customer data, browser tab, or unrelated application is visible.
- The Plugin Manager README uses the accepted poster as a clickable link to the
  MP4. The Codex English and Chinese READMEs provide secondary text links; the
  existing Codex capability demo remains their primary visual.
