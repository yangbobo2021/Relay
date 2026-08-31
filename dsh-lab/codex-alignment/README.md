# Codex execution alignment probe

Official reference: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
The historical comparison runs use the installed, unmodified official DSH
`0.1.0-rc.8`. Prerelease acceptance additionally uses a fresh official
`0.1.1-rc.2` installation with the plugin's default bundled runtime; see
`prerelease-20260831.md` for the separate results.

`run.mjs` creates a separate DSH home, profile, link store and local HTTP host.
It reuses dependency packages from a specified source profile read-only and copies
the backend package into the test profile (or extracts the supplied candidate
tarball). It never installs into or restarts the source profile. The selected
Codex executable is an explicit profile override; the plugin's bundled dependency
is not silently upgraded.

The first turn submits the unchanged release-status question with Sol High and
full access, checks the effective DSH permission preset before sending it, waits
for completion and retains the real presentation history. `--probe` adds a second
turn that explicitly exercises a negative dynamic-tool result; it is excluded
from first-turn benchmark metrics. All model calls are real; no answer, network
result, tool choice or transcript is mocked.

```sh
node dsh-lab/codex-alignment/run.mjs \
  --dsh-bin /path/to/official/dsh/lib/bin.js \
  --profile-source /path/to/existing/profiles/web \
  --codex-command /path/to/reference/codex \
  --candidate-tarball /path/to/candidate.tgz \
  --artifacts /private/output/new-run \
  --workspace /path/to/project \
  --label 'Alignment candidate' --probe
```

Omit `--candidate-tarball` to copy the original installed backend, allowing a
runtime-only comparison. Use a fresh artifacts directory for every invocation.
The source profile, candidate and model account remain operator-owned inputs;
this is not an environment-independent public benchmark. The user project is the
same read-only task subject, not a recreated historical Git worktree.

`compare.mjs` reads existing native rollouts without executing their contents. It
compares only each first completed turn, records source hashes and effective
configuration, and exports visible calls and final answers without hidden
instruction text or reasoning. Its tool-wall metric is the recorded interval
between each call and its return, not a breakdown of model or server latency.

```sh
node dsh-lab/codex-alignment/compare.mjs /private/output/comparison.json \
  app=/path/to/app-rollout.jsonl dsh=/path/to/dsh-rollout.jsonl
```

Keep raw transcripts, private paths, profiles and reports outside the repository.
Do not copy Desktop prompts or infer identical behavior from a matching client
name. Compare runtime version, effective permissions, instruction fingerprints,
actual outcomes and error visibility separately. One task and a few repetitions
cannot establish general model parity or a latency guarantee.

## Broader real-model acceptance suite

`suite.mjs` creates disposable workspaces for code repair, CSV aggregation,
preserved shell errors, context continuity after host restart, and cancellation
followed by recovery. Every case runs through a direct native App Server client,
DSH native comparison mode, and DSH enhanced mode. Oracles check files, test exit
codes, output markers, and process termination. The reference is explicitly not
the Desktop UI; keep its results distinct from the historical Desktop benchmark.

Use the same arguments as `run.mjs`, omitting `--workspace` and `--label`.
Optional `--engine reference|native|enhanced` narrows the run. A separate
`--tasks approval --permission workspace-write` run exercises real approval
acceptance and rejection. Its driver only authorizes the exact fixture-owned
output path once; unexpected approval requests are rejected. It changes neither
the production profile nor global Codex configuration.

Use `--tasks locale` for the real macOS `shasum` regression. It requires exactly
one successful command without a model-authored environment workaround. Approval
events use the official web host's WebSocket transport at `/api/events.mux`.

The suite uses the operator's existing model login and consumes model usage.
It never publishes, installs into the production profile, or exposes a listener
beyond loopback. Keep artifacts outside the repository, and use a fresh output
directory for every run. Timing is diagnostic, not a service performance promise.

## Round-two validation

`cancel-trace.mjs` instruments real native turn notifications and fixture-owned
processes to distinguish an interruption acknowledgement from actual process
termination. See `round2-20260831.md` for the late-notification race and fix.
Repeated `--tasks cancel,cancel,cancel` suite cases use distinct directories and
cancel immediately after startup, after 100 ms, and after 1 second.

`--tasks failure,memory-long` adds controlled HTTP 404/503/timeout cases and
eleven-turn requirement recall with host restart and explicit native compaction.
The network responses are deliberately controlled fixtures; model decisions and
tool execution are real. Compaction does not test a DSH UI button.

`paired-fixtures.mjs serve /private/registry` starts a loopback fixture registry.
`init /private/tasks http://127.0.0.1:PORT` creates separate equivalent App/DSH
fixtures and prompts for two repetitions of three tasks. Run App cases as real
Desktop tasks with user authorization. Run their DSH counterparts with
`run.mjs --question-file /private/tasks/CASE.prompt.txt --model MODEL --effort EFFORT`
and the corresponding App working directory; other required arguments are above.
Do not execute both engines concurrently when comparing latency. Finish with
`paired-fixtures.mjs verify /private/tasks`; inspect every result, including
protected-file hashes, rather than trusting the agents' final claims.

## Default bundled runtime and fresh installation

Create a disposable DSH home with the official `plugin --profile web install`
command, then `plugin --profile web add /private/candidate.tgz`. Do not reuse a
production profile. `suite.mjs --installed-home /private/disposable-dsh-home`
uses that installation directly, verifies its host bundle against the candidate,
and omits all Codex executable overrides. Supply one `--engine native|enhanced`,
the usual `--dsh-bin`, `--candidate-tarball`, `--artifacts` and selected `--tasks`;
omit `--profile-source` and `--codex-command`. This mode intentionally writes test
permission/mode settings to the specified disposable home and creates Sessions.
It retains the account login outside the fixture but never copies credentials.

`scripts/verify-dsh-official-install.mjs --codex-only` limits fresh-install and
headless browser-loader checks to the Codex package, without packing unrelated
plugin changes. `DSH_BIN` selects an installed official host and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing compatible browser.
