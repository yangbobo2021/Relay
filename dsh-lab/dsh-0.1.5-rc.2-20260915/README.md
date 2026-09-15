# DSH 0.1.5-rc.2 Compatibility Record

Date: 2026-09-15

## Official target

- Release: `@deepseek-ai/dsh@0.1.5-rc.2`
- Git tag: `dsh-v0.1.5-rc.2`
- Official tag commit: `fb2c4b9e698e30edb738bca4cf0618587db7d203`
- npm integrity: `sha512-8Xc8hCQHcIWRmTCVU/xZdp6/qMsWMeAd2ObChKDEsfhUPJFXx6H0lgeb1DxUMD86HZrrVN+1bCvn1ppjZ/fOxw==`
- Release page: <https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2>

The official tag was fetched read-only to resolve the exact commit. The protected
`upstream/deepseek-harness` checkout remained detached at its existing official
reference and clean before and after the tests.

## Scope

The maintained matrix contains exactly these 10 plugins:

1. `relay-dsh-plugin-manager@0.3.1-rc.2`
2. `relay-dsh-plugin-session-import@0.2.3-rc.2`
3. `relay-dsh-plugin-codex@0.2.3-rc.3`
4. `relay-dsh-plugin-claude@0.2.3-rc.2`
5. `relay-dsh-plugin-events@0.2.4-rc.1`
6. `relay-dsh-plugin-semantic-router@0.2.3-rc.2`
7. `relay-dsh-plugin-monitors@0.3.2-rc.2`
8. `relay-dsh-plugin-monitor-time@0.1.2-rc.2`
9. `relay-dsh-plugin-monitor-process@0.1.2-rc.2`
10. `relay-dsh-plugin-monitor-author@0.1.2-rc.2`

Retired Workbench, Files, and Terminal packages were excluded by design.

## Result

No rc.2-specific implementation adaptation was required. The dual-version
candidate line also contains the compatibility paths needed by `0.1.6-alpha.1`;
those paths were regression-tested here against rc.2. DSH-facing peer ranges and
development-version gates declare the exact release.

All 11 maintained scenarios passed against the official npm runtime:

- manager only;
- session import only;
- router only;
- monitor core only;
- Events + Router + Monitor Core + Time, including durable timer replay;
- Monitor Author + Time + Process, including authored Bundle installation;
- Events only, including HTTP validation, deduplication, and UI state transition;
- Codex only, including session creation and preset/model synchronization;
- Claude only, including session creation;
- Codex + Claude; and
- the full 10-plugin composition.

The 10 packages then rebuilt successfully against the official `0.1.5-rc.2`
published declaration graph. The packed outputs from that build passed the full
10-plugin browser composition again on the `0.1.5-rc.2` runtime.

The remaining `pnpm peers check` warnings are not DSH-version mismatches:
`lucide-react` requests a profile-level React peer, and Semantic Router's existing
`@deepseek-ai/schemastery` peer is not a direct profile dependency. Both paths
loaded successfully in the browser acceptance run; they are recorded separately
and do not change the rc.2 compatibility result.

## Reproduction

```bash
DSH_ROOT=/path/to/clean/official/deepseek-harness \
DSH_BUILD_ROOT=/path/to/prepared/0.1.5-rc.2/declaration-graph \
DSH_BIN=/path/to/@deepseek-ai/dsh/lib/bin.js \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome \
node scripts/verify-dsh-official-install.mjs --maintained-only
```

`--maintained-only` rejects the three retired workspace plugins from the current
compatibility matrix.
