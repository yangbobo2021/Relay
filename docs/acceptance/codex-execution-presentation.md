# Codex execution presentation delivery acceptance

Date: 2026-08-30.
Official DSH: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`, unchanged.
Scope: the Codex plugin's grouped process presentation, persistence compatibility,
and its installation into the official DSH host. No PR or release is performed.

Requirements and slice reviews:
[SPEC](../../integrations/codex/docs/spec/execution-presentation.md),
[review record](../../integrations/codex/docs/spec/execution-presentation-review.md).

## Gate status

PASS within the compatibility boundaries below. All eight delivery-runner checks,
three coexistence checks and nine installation combinations passed. Desktop,
expanded failure, cancelled-output and narrow-viewport captures were visually
reviewed. No known blocking finding remains in this presentation scope; the
working-tree candidate is ready for PR review, not already released.

## Reproducible checks

From the Relay root, with dependencies installed and the pinned official DSH CLI
and Web distribution already built:

```sh
npm --prefix integrations/codex run verify
npm test
npm run test:install:dsh-official
npm run test:e2e:codex-delivery
npm run test:e2e:codex-coexistence
```

Use an installed Playwright Chromium, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible browser executable. The live
commands require existing Codex authentication; coexistence also requires Claude
authentication. They execute real paid/authenticated model calls. They do not
publish packages, attach to the user's browser, or change the user's DSH profile.
The file-opening case invokes the real DSH/OS opener for a temporary fixture.

The delivery runner packs published `relay-dsh-plugin-codex@0.1.4` and the current
candidate separately, installs them successively into an isolated profile, checks
the installed client SHA-256 against the built candidate, and cold-restarts DSH.
The model is explicitly `gpt-5.6-sol` with `high` reasoning. Evidence directories
and isolated profiles are printed by the runners. Screenshots, result JSON and
raw logs remain outside Git; do not commit real model-session logs.

## Results

| Requirement | Evidence | Result |
| --- | --- | --- |
| EXEC-01..16 projection, ordering, fallback, native ownership | Codex `npm run verify`: 232 unit and 121 component tests; typecheck and host/client builds | PASS |
| Whole repository regression | Root `npm test`: 450 tests, no failures or skips | PASS |
| EXEC-17 loader and installation | Actual tarballs, isolated profiles, configuration composition, HTTP assets and actual browser loader execution | 9/9 PASS |
| EXEC-19 backend coexistence | Native official DSH adapter with deterministic HTTP/SSE provider; real Claude Sonnet SDK; real Codex Sol High; switch and reload | 3/3 PASS |
| EXEC-18 upgrade and replay | Published 0.1.4 to separately packed candidate; bundle identity; old history plus new execution; cold restart | PASS |
| EXEC-20 keyboard and narrow reading | Actual Enter/Space on process, group and command; 390 x 844 viewport, usable width and decoded image within viewport | PASS; captures reviewed |
| EXEC-21 file/image workflow | Real `apply_patch` changed fixture bytes; image-view decoded 320 x 180 bytes; final file button returned `opened: true` from DSH's OS opener | PASS |
| EXEC-05/12/22 failure and cancellation | Intentional exit 7; new Session stopped after first yield; actual persisted stdout retained; cancelled and completed histories cold-reopened | PASS |
| EXEC-11 exact user question | Earlier real Sol High acceptance: 3 commentary messages, 12 commands grouped 3/9, final answer and cold replay | PASS; prior evidence retained |
| EXEC-14 generated image | Valid image bytes through deterministic App Server protocol fixture, one persisted image before final prose; collapse visibility component regression | PASS; not a live image-generation API call |

Installation scenarios: Codex only, Claude only, Events only, Codex + Claude,
Workbench only, Workbench + Files, Workbench + Terminal, Codex + Terminal with
Workbench, and the combined plugin suite. The dependency gate permits only the
existing neutral Session Import hub as a backend dependency, not the Relay event
runtime, Workbench, Terminal or another backend.

The exact earlier question was:
`当前Relay项目还有哪些逻辑没有实现为DSH插件？`.
The earlier run took 151 seconds; it is functional evidence, not a performance
comparison with a separate Codex App run.

Final local evidence identifiers (directories are printed by the runners):

- Delivery: `relay-codex-delivery-6gHd5K`, all eight cases passed.
- Coexistence: `relay-codex-coexistence-wvKr7s`, all three cases passed.
- Installed candidate client SHA-256:
  `ab69b6a5d734155fbb4048b69fd78625aa0fdc810306238c80c6db39fb592a9a`.
- Delivery captures: `01-baseline.png`, `02-live.png`, `03-complete.png`,
  `04-expanded-error.png`, `05-reloaded.png`, `06-mobile-390.png`,
  `07-cancelled.png`. The solid green image is a deliberate decoding fixture.

## Findings and review

| Slice | Finding | Resolution and regression |
| --- | --- | --- |
| File delivery | Synthetic Codex edits did not supply native file-mention metadata; a final filename could remain inert | Resolve completed structured edits through the native DSH opener; six focused cases cover exact/ambiguous paths, status, deletion, rename and native priority |
| Cancellation | Output/settlement received while the interrupt RPC was pending could remain in the queue and be discarded | Drain only already-owned commands from that turn; native/raw/snapshot late-output cases reject foreign and unowned work |
| Generated images | Live image-view alone did not prove image-generation completion ordering | Add a valid-byte generated-image protocol regression and retain component collapse/ordering checks |
| Installation | Asset HTTP success did not prove the client module table could execute | Boot a real browser for every installation combination; reject page errors and loader failure messages |
| Test oracle | Searching displayed command text could mistake an input marker for retained stdout | Assert the persisted activity's output field for intentional failure and cancellation |
| Responsive oracle | Zero document overflow could still hide a squeezed conversation beside the sidebar | Exercise the native collapsed-sidebar reading state; require a usable conversation width and an image inside the viewport, then visually inspect the capture |

## Compatibility boundaries

- Old Threads created without raw first-yield notifications cannot enable them
  through upgrade/resume in the pinned Codex runtime. Their history and Thread
  identity are preserved. Native output still works; first-yield retention is
  verified on a newly created post-upgrade Session. Never silently recreate an
  existing Thread to make a presentation test pass.
- Output not yet delivered by the execution backend at an immediate stop cannot
  be reconstructed. Tests distinguish received stdout from command input.
- The 390 x 844 case is a real browser viewport with the native sidebar collapsed,
  not a physical phone or a claim that an expanded sidebar remains usable at that
  width. No screen-reader or additional OS/browser certification is claimed.
- Native DSH coexistence uses a deterministic provider through its real adapter;
  Claude and Codex use their actual authenticated backends. Image generation uses
  a protocol fixture, while image viewing exercises actual model execution and
  browser image decoding.
- This implements the grouped interaction, not pixel-for-pixel Codex App parity.
  Insufficient or foreign history keeps native DSH rendering.

## Release boundary

These checks qualify the working-tree candidate, not an npm release. The candidate
still carries the development version `0.1.4`; a future release must choose a new
version and follow the repository's independent plugin review/release workflow.
No commit, push, tag, PR, or registry publication is included in this acceptance.
