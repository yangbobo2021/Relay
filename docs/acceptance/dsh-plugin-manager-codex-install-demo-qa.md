# DSH Plugin Manager Codex Install Demo QA

The all-English recording was accepted on 2026-08-27 against an isolated DSH
profile and the unmodified official DeepSeek Harness checkout at commit
`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.

## Live Scenario

- DSH model: `DeepSeek-V4-Flash / High`.
- Browser locale and DSH UI preference: English (`en-US` / `en`).
- Plugin Manager: `relay-dsh-plugin-manager@0.1.0-rc.3` from npm.
- Search request: exact discovery of `relay-dsh-plugin-codex` without installing.
- Search result: npm package `relay-dsh-plugin-codex@0.1.2` and its GitHub source.
- Installation boundary: the manager produced a plan without changing state,
  then executed only after a separate explicit confirmation message.
- Final status: `succeeded / completed`, package version `0.1.2`, changed `true`,
  activated `true`, `restartRequired: false`, and exit code `0`.

The recording used a fresh temporary DSH home and a temporary demo workspace.
No local package link, tarball, or workspace source supplied the installed Codex
plugin. A separate live acceptance run also passed npm and GitHub discovery,
integrity checks, and the install/disable/enable/update/remove lifecycle before
the recording.

## Event-Aware Edit

The 63.40-second WebM source and machine-readable event timeline remain under
the ignored `.artifacts/` directory. The accepted 40.03-second English edit
retains every meaningful interaction package while removing only model waits:

| Source interval | Evidence retained |
| --- | --- |
| `1.0-8.0` | Stable English UI, search text, submission, and `plugin_discover · search` start |
| `18.0-31.3` | Exact npm/GitHub result, plan-only request, and `plugin_manage · plan` start |
| `37.0-50.5` | Plan result, separate confirmation, and `plugin_manage · execute` start |
| `57.2-63.4` | Stable final result with package name, version, activation, and restart status |

No visible typing, click, submission, state change, or readable result was
removed from a retained interaction package.

## Media QA

| Artifact | Properties | SHA-256 |
| --- | --- | --- |
| `dsh-plugin-manager-codex-install-demo.mp4` | 37.80 s, H.264 High, 1280x720, 30 fps, yuv420p, faststart, no audio | `95cb8b22e510229018bfb5a40b717498f5a0af2e371ba5460ac2e04be6559fbe` |
| `dsh-plugin-manager-codex-install-demo.en.mp4` | 40.03 s, native English DSH UI, English conversation, and burned-in English event captions; H.264 High, 1280x720, 30 fps, yuv420p, faststart, no audio | `3e130c1aa9a795f8861055f4858f01e07b9e612069c4ff152eb11a42734f75ed` |
| `dsh-plugin-manager-codex-install-demo.zh.mp4` | 37.80 s, burned-in Simplified Chinese event captions, otherwise the accepted source framing and sequence | `89441a7dd7db4fa85440b7df7ba5829edde3648820ef54b32210cac95c670801` |
| `dsh-plugin-manager-codex-install-success.png` | 1280x720 English poster extracted from the accepted English MP4 | `a245a2e571d966b052e565f6d468f6944139b7620aa31c4ebbbd602d92cf3fb3` |

- Full ffmpeg decode completed for all 1,201 frames of the new English video
  without an error. The previously accepted base and Chinese versions are
  unchanged.
- Black-frame detection with a 0.5-second threshold found no black interval in
  the new English video.
- A 16-frame contact-sheet inspection plus full-resolution final-poster review
  passed for the new English video.
- Frame-zero inspection passed at 1280x720. Its `signalstats` luma average is
  `229.49`, above the automated `220` completeness threshold; the rejected
  partial browser canvas measured `164.01`.
- The first interaction visibly enters the exact plugin search; the midpoint
  preserves the plan-only boundary; the final frame visibly shows `succeeded`,
  `relay-dsh-plugin-codex`, and npm version `0.1.2`.
- The recording harness asserted that `document.documentElement.lang` was `en`
  and that visible body text contained no CJK characters at setup, recording
  start, and final result. Manual contact-sheet review found no Chinese UI,
  prompt, reply, tool label, caption, or status text.
- The final interface visibly identifies the official DSH build and the selected
  model as `DeepSeek-V4-Flash / High`.
- No API key, token, local username, host name, private filesystem path,
  customer data, browser tab, or unrelated application is visible.
- All caption boxes stay inside the existing top safety area and do not cover
  the search result, plan, confirmation, tool state, or final status table.
- The Plugin Manager and Codex English READMEs use the English-captioned MP4.
  The Codex Chinese README uses the separate Chinese-captioned MP4. The base
  MP4 remains available as the uncaptioned acceptance source.
