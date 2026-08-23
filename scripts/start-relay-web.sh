#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_root="$relay_root/upstream/deepseek-harness"
plugin_roots=(
  "$relay_root/integrations/deepseek-harness"
  "$relay_root/integrations/codex"
  "$relay_root/integrations/claude"
)
dsh_commit="$(git -C "$dsh_root" rev-parse HEAD)"

dependency_stamp="$(git hash-object "$relay_root/package-lock.json")"
dependency_marker="$relay_root/node_modules/.cache/relay-workspace-dependency-stamp"
if [[ ! -x "$relay_root/node_modules/.bin/tsdown" \
  || ! -d "$relay_root/node_modules/@xterm/xterm" \
  || ! -f "$dependency_marker" \
  || "$(<"$dependency_marker")" != "$dependency_stamp" ]]; then
  (cd "$relay_root" && npm install --ignore-scripts)
  mkdir -p "$(dirname "$dependency_marker")"
  printf '%s\n' "$dependency_stamp" > "$dependency_marker"
fi

# npm owns Relay's workspace and may remove development symlinks as
# extraneous. Repair the official workspace only after npm has finished.
dsh_dependency_marker="$dsh_root/node_modules/.cache/relay-dsh-dependency-commit"
if [[ ! -e "$dsh_root/packages/settings/settings-file/node_modules/chokidar" \
  || ! -e "$dsh_root/packages/host/apiproxy/node_modules/fflate" \
  || ! -f "$dsh_dependency_marker" \
  || "$(<"$dsh_dependency_marker")" != "$dsh_commit" ]]; then
  node "$relay_root/scripts/repair-dsh-workspace-links.mjs" "$dsh_root"
  pnpm --dir "$dsh_root" install --ignore-scripts --frozen-lockfile
  mkdir -p "$(dirname "$dsh_dependency_marker")"
  printf '%s\n' "$dsh_commit" > "$dsh_dependency_marker"
fi

"$relay_root/scripts/link-dsh-development-peers.sh"

if [[ ! -d "$relay_root/node_modules/@xterm/xterm" ]]; then
  printf 'Relay plugin dependencies were not installed correctly.\n' >&2
  exit 1
fi

for plugin_root in "${plugin_roots[@]}"; do
  (cd "$plugin_root" && npm run build)
done

# Migrate profiles created before the three independent package names. The
# allowlist prevents this launcher from touching any unrelated user plugin.
dsh_home="${DSH_HOME:-$HOME/.dsh}"
profile_manifest="$dsh_home/profiles/web/package.json"
legacy_packages=(
  "relay-dsh-plugin"
  "@relay/dsh-core"
  "@relay/dsh-codex"
  "@relay/dsh-claude"
  "@relay/plugin-codex"
  "@relay/plugin-claude"
)
if [[ -f "$profile_manifest" ]]; then
  for legacy_package in "${legacy_packages[@]}"; do
    if node -e 'const p=require(process.argv[1]); process.exit(p.dependencies?.[process.argv[2]] ? 0 : 1)' "$profile_manifest" "$legacy_package"; then
      pnpm --dir "$dsh_root" dsh plugin --profile web remove "$legacy_package"
    fi
  done
fi

build_marker="$dsh_root/node_modules/.cache/relay-dsh-build-commit"
if [[ ! -f "$dsh_root/apps/web/dist/index.html" \
  || ! -f "$dsh_root/apps/cli/lib/bin.js" \
  || ! -f "$build_marker" \
  || "$(<"$build_marker")" != "$dsh_commit" ]]; then
  pnpm --dir "$dsh_root" run build
  mkdir -p "$(dirname "$build_marker")"
  printf '%s\n' "$dsh_commit" > "$build_marker"
fi

pnpm --dir "$dsh_root" dsh plugin --profile web add "${plugin_roots[@]}"

# The source-mode DSH loader resolves plugin names from the upstream workspace.
mkdir -p "$dsh_root/node_modules/@relay"
for package in plugin-events dsh-plugin-codex dsh-plugin-claude; do
  case "$package" in
    plugin-events) source="$relay_root/integrations/deepseek-harness" ;;
    dsh-plugin-codex) source="$relay_root/integrations/codex" ;;
    dsh-plugin-claude) source="$relay_root/integrations/claude" ;;
  esac
  target="$dsh_root/node_modules/@relay/$package"
  rm -rf "$target"
  ln -s "$source" "$target"
done

# DSH dynamically imports this client package outside its source aliases.
picker_link="$dsh_root/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-native"
if [[ ! -e "$picker_link" && ! -L "$picker_link" ]]; then
  ln -s ../../packages/client/ui-directory-picker-native "$picker_link"
fi

cd "$dsh_root"
exec node --expose-internals --import tsx/esm apps/cli/src/bin.ts web "$@"
