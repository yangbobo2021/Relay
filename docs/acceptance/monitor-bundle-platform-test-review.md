# Monitor Bundle Platform Test Review Protocol

Every implementation increment records two independent conclusions.

## 1. Is The Delivery Test Sufficient?

The reviewer maps changed contracts to scenario IDs and verifies that evidence exists
at every named layer. The review explicitly checks normal behavior, exact boundaries,
provider/configuration failures, concurrency, restart, plugin lifecycle, authorization,
privacy, localization, accessibility, packaging, and upgrade behavior. A direct
handler call is not accepted when the scenario names a real sandbox, HTTP protocol,
packed artifact, official DSH, browser, operating-system process, or live provider.

The reviewer also asks whether a passing test actually proves the user-observable
outcome: the catalog is live, the Wait and Monitor committed atomically, the Agent
turn ended, the same Session/backend resumed, and duplicate work did not occur.

## 2. Did The Test Execute Correctly?

Every critical guard receives at least one mutation or controlled failure that must
turn the relevant gate red. Required mutations include:

- accept a duplicate Bundle Type or stale disposer;
- return a cached catalog after plugin unload;
- accept a caller-supplied Session ID;
- skip artifact hash verification between validation and install;
- expose an environment variable or perform an undeclared broker call;
- weaken Process Handle identity to PID only;
- disable stable trigger-key uniqueness;
- treat provider unload as successful observation;
- make the Skill claim installation from generated prose;
- remove one locale or accessible name.

The review records the failing assertion/output and the restored passing run. It
rejects skipped tests, empty test discovery, swallowed command status, stale artifacts,
workspace-source resolution where packed evidence is required, and assertions that
only restate fixture input.

## Increment Review Record

For every small delivery change record:

1. affected MB requirements and scenario IDs;
2. SPEC/public API changes;
3. implementation files and package boundaries;
4. tests added or changed at each required layer;
5. observed failure before the fix or mutation failure;
6. exact executed commands, counts, and non-zero failures;
7. packed artifact hashes where applicable;
8. remaining open scenarios and why they block delivery.

No “expected to pass,” manual code inspection, or prior run from a different artifact
is accepted as PASS evidence.

## Delivery Review — 2026-09-02

### Sufficiency conclusion

The release evidence crosses every product boundary changed by this upgrade:

- Monitors: 50/50 tests pass against the production QuickJS WASM sandbox, capability
  broker, custom artifact store, live Bundle registry, update/rollback, expiry cleanup,
  provider lifecycle, and Agent-tool ownership. Typecheck, bundled build, and dry-run
  package inspection also pass.
- Events: 58/58 tests pass, including SQLite version history, atomic rebaseline and
  rollback, live catalog keyset pagination, malformed cursors, one-over limits, and
  the management client contract. Typecheck, Host/client builds, and dry-run package
  inspection pass.
- Time, Process, GitHub, and authoring Skill: 6/6, 4/4, 24/24, and 2/2 tests pass;
  each distribution's dry-run package contains only its declared public files.
- Repository composition: 18/18 Event/Monitor scenarios pass. In particular,
  MB05-007 and MB06-008 reopen the same SQLite file and prove that legacy provider
  IDs, detector kinds, Monitor/Wait IDs, active version, last observation, deadline or
  PR subject, continuation, Session, and correlation/trigger key survive extraction.
- Real process flow: a child process is baselined through the public Agent tools,
  Relay and its SQLite/artifact/identity stores restart, the child exits, and exactly
  one `process.exited` Event resumes the same Session. Expiry independently proves a
  terminal Monitor/Wait with no fabricated Event.
- Full repository integration discovery passes 467/467 with zero fail, skip, todo, or
  cancellation. This includes the new packages in the root workspace command.
- Packed-package audit passes for Events, Monitors, Time, Process, Semantic Router,
  GitHub, and Email. A clean temporary install imports the three independently built
  DSH packages only through public entries.
- Official DSH `dd6322d604e00eec1ba5e0c8541159906a21094a` installs the final tarballs
  into a fresh profile and passes the complete browser matrix. The catalog contains
  24 types from a separate fixture extension plus Time and GitHub, two stable pages,
  English/Chinese content, live availability states, redacted permissions, light/dark
  WCAG AA contrast, keyboard/focus behavior, 1280×720 and 1440×900 geometry, and clean
  browser console/network output.

Final official-DSH SHA-256 artifacts were:

| Artifact | SHA-256 |
| --- | --- |
| Events | `98527dd69df6d43013851641bbe31e4cec8a56939d4045244fef4145119bcef2` |
| Monitors | `f0405536fc3aa89dc9e4e256ae838343d20bbd98163ab5ea54dd5c9550e192f4` |
| Time | `e7c9270e6218cf2f0b1e68c1517755c6e15ddbe5fa8365aae2fb85238ad6f00b` |
| GitHub | `e1486028bc2c0baffac70563c50958571b3b3c4576375c19edb99695da2abea2` |
| Third-party fixture | `7d8870a9d8909e77aadbe34900f9288f51ee68d955537ea2fc2adbb3d743dc5c` |

### Execution-integrity conclusion

The tests demonstrably exercised the intended production paths rather than merely
restating fixtures:

- the official browser gate first failed on dark-mode remediation contrast (3.68:1),
  then on ambiguous pagination after the second pager was added, then on a `zh` versus
  `zh-CN` provider-locale mismatch; each remained red until the production UI or its
  scoped acceptance locator was corrected and the entire matrix reran;
- custom update review first exposed an aliased fixture that could not prove capability
  expansion. The fixture was made independent, after which the production rollback
  guard rejected the expansion and the restored suite passed;
- version review exposed that source SHA alone conflated equal code with different
  manifests. The persisted version SHA now includes normalized manifest, authorization,
  and lineage, and a regression proves the two versions are distinct;
- the independent package gate failed non-zero because it ignored the supplied
  `DSH_ROOT` and assumed a worktree-local upstream checkout. The verifier now resolves
  the explicit immutable checkout; the same command then installed and imported all
  packages successfully;
- the first Monitors CI push failed at standalone `npm ci`: its child lockfile lacked
  QuickJS even though the hoisted root workspace made local tests green. A first
  attempted lock refresh was itself rejected because npm still discovered the parent
  workspace. The accepted fix uses `--workspaces=false`; standalone install and the
  complete 50-test/build/pack verification then pass before the lockfile is committed;
- the first in-app-browser launch inherited an unrelated old Events database and failed
  on a missing schema column. It was rejected as contaminated evidence; a new isolated
  Events/Email database profile then rendered the live Time catalog successfully;
- all final commands report non-zero test discovery and zero skip/todo. The official
  checkout remains clean, and generated Codex client output accidentally touched by a
  build was removed from the delivery boundary.

No Gmail or public-GitHub credential is required for this release gate. Provider
protocol, signature, pagination, authorization, convergence, and redaction are covered
with deterministic local HTTP and SQLite evidence; connecting a real external account
is an optional environment certification, not a condition for publishing the platform.
