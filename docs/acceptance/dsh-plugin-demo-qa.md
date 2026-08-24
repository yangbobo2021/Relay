# DSH Plugin Demo Acceptance Evidence

Recorded on 2026-08-24 against a clean profile created by the official
`@deepseek-ai/dsh@0.1.1-rc.2` npm package. The official DSH source checkout was
not modified.

## Installed npm Packages

| Package | Resolved version |
| --- | --- |
| `relay-dsh-plugin-codex` | `0.1.1-rc.3` |
| `relay-dsh-plugin-claude` | `0.1.1-rc.2` |
| `relay-dsh-plugin-workbench` | `0.1.0` |
| `relay-dsh-plugin-files` | `0.1.0` |
| `relay-dsh-plugin-terminal` | `0.1.0` |

No local tarball, workspace link, or source checkout supplied these packages.

## Live Acceptance

- Codex mode selected `GPT-5.6-Sol / Low`; Codex App Server returned
  `Codex App Server is live inside DSH.`
- Claude Code mode selected `Claude Sonnet / Medium`; Claude Agent SDK returned
  `Claude Code is live inside DSH.`
- Files filtered and rendered the real Relay workspace `README.md`.
- Terminal started zsh in the Relay workspace and executed
  `echo RELAY_DSH_PLUGINS_ARE_LIVE`; both command echo and command output were
  observed.
- Workbench hosted the Files side view and Terminal bottom view through their
  registered plugin surfaces.

The raw recording was 64.56 seconds. Only two model-wait intervals and an
aborted decorative closing action were removed; typing, clicks, panel changes,
terminal input, and all results remain visible.

## Media QA

| Artifact | Properties | SHA-256 |
| --- | --- | --- |
| `dsh-plugin-suite-demo.mp4` | 33.4 s, H.264 High, 1440x900, 30 fps, yuv420p, faststart | `7f53fb486d284683105b30a974e3ed370b8e976f4d20a17a5f656beaf713d758` |
| `dsh-plugin-suite-demo.gif` | 15.0 s, 960x600, 12 fps, 180 frames | `13ea956af475e0d5d893349ec2933e1942db45afd3d7eb071ffc0cb0cdd86628` |
| `dsh-plugin-suite-live.png` | 1440x900 RGB screenshot | `ee9312ba9ab3741bfd4b4513d5f1dceedca6b07eec383751aff4d6634f330197` |
| `dsh-codex-conversation-live.png` | 1440x900 RGB still at 12.0 s | `27451311b47e0382b74f15fc5400bacfc07cdde15b5b850978b64d693b019136` |
| `dsh-claude-conversation-live.png` | 1440x900 RGB still at 28.0 s | `c0edf93edb016fd65189d04b8e11a1ac5f8793dd4c4e047e8d42a3ad7b4ee827` |
| `dsh-terminal-command-live.png` | 1440x900 RGB still at 22.5 s | `41bc76f670a7593fbad3f9e9c4078c7a84a85ebaf8ab2ad4e44116ee4665e848` |

Both MP4 and GIF completed full ffmpeg decode without errors. Black-frame
detection found no black interval. Google Chrome loaded the MP4 at
`readyState=4` with the expected duration and dimensions; QuickTime Player
opened and held the final MP4 file successfully. The MP4 `moov` atom precedes
`mdat`, confirming fast-start layout.

The checked-in recorder was also rerun end to end after the final selector fix.
It completed all seven scene checkpoints, wrote both model-wait intervals to
`timeline.json`, and finalized a playable WebM source.

The three article stills above were extracted from the accepted H.264 recording
at the stated timestamps. They are not recomposed screenshots or interface
mockups.
