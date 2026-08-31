# Bundled-runtime prerelease acceptance

Official immutable DSH reference: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
Fresh installed host: official npm `@deepseek-ai/dsh@0.1.1-rc.2`.
Plugin release candidate: `relay-dsh-plugin-codex@0.1.6-rc.1`.
Bundled runtime: `@openai/codex@0.149.0`, without a Desktop executable override.
Model: `gpt-5.6-sol`, reasoning effort `high`.

Plugin PR [#30](https://github.com/yangbobo2021/relay-dsh-plugin-codex/pull/30)
was squash-merged as `90b3038ed4eca4cf43a4df2049180f8f1f134811`.
Its tree equals tested candidate commit
`dfe3e20adbdcdbf2855e17d78fa8336df6e9b274`. The prerelease tag points to the
merge commit and targets npm `next`; the stable channel must stay at `0.1.5`.

## Completed prepublication gates

- Typecheck, 243 unit tests, 121 component tests and build pass.
- Three-platform CI runs the real bundled App Server with an empty executable
  search path and a disposable credential-free Codex home. It starts a thread,
  inventories background terminals, and changes thread settings. No model turn
  or account credentials are sent to CI.
- An official clean profile installs the candidate tarball, composes its bundle,
  boots the web host and loads the actual plugin browser module.
- 15 Relay repository-boundary checks pass.
- All 21 package files were inspected against the candidate source/build;
  private validation archives and transcripts are excluded.

The `suite.mjs --installed-home` mode validates the actually installed package,
checks its host bundle against the candidate tarball, and removes the Codex
executable override. It writes test settings only in an explicitly supplied
disposable home. Three runs passed all 16 cases / 36 model turns:

| Mode | Permission | Cases |
| --- | --- | --- |
| enhanced | full access | repair, CSV, error output, restart/recall, 11-turn changed requirements with native compaction, controlled HTTP failure handling, cancellation/recovery at three delays |
| native | workspace write | approval acceptance/rejection, error output, cancellation/recovery at three delays, restart/recall |
| enhanced | workspace write | approval acceptance/rejection |

These model tasks ran on the local Mac. Cross-platform protocol CI is not a
claim that the full model suite ran on Windows and Linux. Controlled HTTP
responses are fixtures; model choices and tool execution are real.

Historical true Desktop comparisons in `round2-20260831.md` used an explicit
`0.151.0-alpha.7.2` executable. They remain separate evidence and are not
substituted for default-runtime acceptance. An intermittent native command-item
output omission and the macOS locale/shasum issue remain unresolved. Subsequent
passing runs do not erase those failures or prove full Desktop parity.

No production DSH profile, global Codex configuration or immutable upstream
checkout is modified. The Relay distribution's recorded plugin gitlink is not
advanced to the prerelease. Keep raw logs, account-dependent model traces and
installation directories outside Git.

## Published artifact verification

The [release workflow](https://github.com/yangbobo2021/relay-dsh-plugin-codex/actions/runs/33346942321)
passed all four jobs. npm resolves `next` to `0.1.6-rc.1` and `latest` to `0.1.5`.
The downloaded registry tarball has SHA-256
`c8900c02243aa39530644f1319ffe2069a434d3ce1742b30520aeac07c15bd4c`.
Its inventory matches the 21-file local candidate: source/build files match byte
for byte and package metadata matches semantically.

A second fresh official profile installed the exact npm version, not a local
file dependency. The default bundled runtime then passed all four additional
real-model cases / six turns: repair, error preservation, restart/recall and
cancellation/recovery. These are postpublication smoke checks, distinct from the
16-case prerelease matrix. Total default-runtime coverage is 20 cases / 42 turns.

Install the exact version with the official DSH CLI. Stop DSH before changing
packages. For rollback, reinstall `relay-dsh-plugin-codex@0.1.5`, restore any
profile settings you changed, then restart DSH. Publication did not upgrade the
operator's everyday profile.
