# DSH Lab

Relay-owned DeepSeek Harness research lives here.

Use this directory for:

- Compatibility notes.
- Reproduction cases.
- Small validation scripts.
- Patch files.
- Adapter sketches.
- Commit-pinned observations about DSH behavior.

Do not put the DSH upstream clone here. The clone belongs in `../upstream/deepseek-harness/`.

## Notes

- [Plugin Integration Assessment](plugin-integration.md) maps Relay onto the
  DeepSeek Harness plugin, profile, preset, and Agent lifecycle boundaries.

## Experiments

- [Session And Inbox Probe](cold-resume/README.md) validates bundle lifecycle, DSH
  cold resume, Agent-authored Waits, and Relay delivery through the shared inbox.
- [Codex Session Import Evidence](codex-session-import/README.md) stores sanitized
  run manifests and artifacts for the Codex import risk-validation protocols.
