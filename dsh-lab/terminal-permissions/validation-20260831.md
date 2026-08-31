# Manual terminal permissions: verification, 2026-08-31

## Scope

Keep Codex App Server as the PTY provider. Add an explicit
`sandboxPolicy: { type: "dangerFullAccess" }` only to Terminal's shell
`command/exec` request. Do not modify Codex server arguments, global configuration,
Agent turn permissions, or the official DSH checkout.

Official DSH reference: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`
(`0.1.1-rc.2`). It remained clean before and after verification.
Terminal base commit: `09ed18a80284f8593140e579af05ee6dcd8f8d7b`.
Terminal fix commit: `9ef9bf16e6c9cd45436b387d3ff4ca6472fc4d9a`, pushed to
`codex/fix-manual-terminal-permissions` before updating Relay's submodule pointer.

## Results

- `npm run verify` in the Terminal plugin: typecheck, 12 tests, production build PASS.
- Relay plugin boundary and DSH upstream boundary tests: 9 tests PASS.
- `npm pack --dry-run --json` from the Terminal directory: PASS, 12 package files.
- Source gateway and built Host entrypoint: real PTY SSH connection PASS.
- Packed Host entrypoint loaded against the existing KeySync DSH `0.1.0-rc.8`
  profile dependencies, using KeySync's Node `22.23.2` and Codex CLI `0.149.0`
  on macOS ARM64: PASS.
- Packed archive SHA-1: `dbf11dc78db68771d0a3840d90adee2d9255b751`.
- Two fresh official DSH `0.1.1-rc.2` profiles installed the packed Terminal
  through the official CLI: Workbench + Terminal, and Workbench + Terminal +
  published Codex `0.1.6-rc.1`. Both passed profile composition, Host startup,
  and HTTP checks for the Workbench and Terminal client assets. These checks
  did not exercise browser interaction or change the active KeySync profile.

The real SSH probe used an already trusted user-specified host, batch public-key
authentication, strict host-key checking, and remote `exit`; it did not modify
the remote host. No host address, username, key material, or raw terminal log is
recorded here.

On the same independently launched App Server process:

1. A default-policy SSH command failed with `Operation not permitted`, exit 255.
2. The patched Terminal plugin started a full-access PTY shell. SSH exited 0;
   writing a disposable file outside the project, in the local user home,
   succeeded; `stty size` reported the requested 32 rows and 120 columns.
3. After that shell exited, another default-policy SSH command still failed with
   `Operation not permitted`, exit 255. The terminal did not change server defaults.

The probe creates no Agent/model turn. Agent code and configuration were not
modified; preservation of server defaults was exercised directly rather than
claiming an end-to-end model-turn test.

## Reproduction

`probe.mjs` is a POSIX/macOS diagnostic for an environment whose default Codex
sandbox reproduces the reported denial. Supply the executable, known SSH target,
and workspace explicitly:

```sh
node dsh-lab/terminal-permissions/probe.mjs \
  --codex /path/to/codex \
  --ssh user@known-host \
  --cwd /path/to/workspace \
  --plugin /path/to/extracted/package/lib/host-plugin.js
```

The plugin's runtime dependencies must resolve from its location. The probe
cleans up its temporary home-directory file, terminal, and App Server. It does
not print or persist raw shell output.

## Build environment and limits

The first typecheck found pre-existing duplicate DSH branded `SessionId` types:
generated upstream declarations resolved some peers from Relay's installed npm
packages. Preparing ignored workspace dependency links with the existing
`scripts/lib/dsh-local-workspace-links.mjs` helpers restored a single official
DSH type source. No source casts, typecheck exceptions, or upstream edits were used.

No Linux or Windows live acceptance was performed. The original running KeySync
DSH instance was not restarted or modified during these tests. Four pre-existing
terminals were left running. Applying the new package and restarting DSH remains
a separate activation step; already running shells cannot gain a new policy.

## Stable release: 0.1.1

Terminal PR #1 merged the permission fix; PR #2 prepared the patch version.
The `v0.1.1` tag and `main` point to
`43cd55a83529bec2d30d3b14fea9772b1ad872de`. The release workflow
[33365909827](https://github.com/yangbobo2021/relay-dsh-plugin-terminal/actions/runs/33365909827)
passed and published `relay-dsh-plugin-terminal@0.1.1` through npm trusted
publishing with provenance. Registry metadata confirms `latest: 0.1.1` and the
same Git commit.

Release verification repeated the typecheck, 12 plugin tests, production build,
tracked-artifact reproducibility check, package dry run, 9 Relay boundary tests,
and both clean official DSH installation scenarios described above. Branch, PR,
merged-main, and release CI all passed.

The archive downloaded from npm has SHA-1
`eb24cdbaef330386f55036485a68032099c1e9eb`; its SHA-1 and SHA-512 match registry
metadata. All 12 packaged files are byte-for-byte identical to the locally
verified `0.1.1` candidate. Running the probe against the downloaded npm package
again passed SSH exit 0, the disposable home-directory write, PTY resize, and
preservation of the same App Server's default SSH denial before and after.

Relay's Terminal gitlink advances to the published release commit. No running
KeySync DSH profile was upgraded or restarted as part of publication; activation
still requires upgrading the plugin, restarting DSH, and opening a new terminal.
