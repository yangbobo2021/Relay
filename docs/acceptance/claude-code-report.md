# Claude Code In Native DSH Web Acceptance Report

Date: 2026-08-15

## Environment

| Component | Version |
| --- | --- |
| DSH | `fc18096c87fababb8429b51df655c22649f74e6f` |
| Claude Agent SDK | `0.3.233` |
| Claude Code | `2.1.219` |
| Browser surface | Native DSH Web at `http://127.0.0.1:4318` |

## Results

| Requirement | Result | Evidence |
| --- | --- | --- |
| Claude appears in new Session presets | PASS | A new DSH Session listed and selected `Claude Code`; the model selector showed Claude Sonnet and reasoning effort. |
| Incremental thinking and answer output | PASS | Live turns displayed distinct `Think` rows while generating and streamed the final answer into the native conversation. SDK message/block identity prevents partial and final snapshots from duplicating new output. |
| Tool start, completion, input and output | PASS | A live Bash turn displayed a `Bash` activity row; expanding it showed the command, `RELAY_TOOL_ROW_OK` output, Claude Session ID and Turn ID. |
| Interactive tool approval | PASS | A live Write request paused the same turn, displayed DSH `Reject` and `Allow once` controls with the target filename, then continued after approval and created the expected probe content. The probe was verified and removed after acceptance. |
| Stop | PASS | A live long-running turn exposed `Stop generating`; clicking it changed the turn to `Stopped`, restored the composer, and did not emit the requested final marker as an assistant answer. |
| Session continuation | PASS | The same Claude session resumed after a DSH Host restart and accepted another turn. |
| CLI fallback boundary | PASS | Automated tests preserve structured streaming/session/cancellation behavior. Interactive approval remains an SDK-only guarantee as specified. |

## Automated Verification

- `npm run test:claude`: 17 passing tests.
- `npm test`: full Relay regression suite.
- `npm run experiment:dsh-bundle`: DSH production bundle lifecycle.

The browser run also exposed and closed three presentation gaps before acceptance:
Claude preset installation, completed tool metadata loss, and duplicate SDK partial/final
thinking or text projection.
