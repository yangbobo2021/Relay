#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_root="$relay_root/upstream/deepseek-harness"
plugin_root="$relay_root/integrations/deepseek-harness"
plugin_modules="$plugin_root/node_modules"
dsh_commit="$(git -C "$dsh_root" rev-parse HEAD)"

"$relay_root/scripts/install-dsh-presets.sh"

# Relay owns its browser and build dependencies. A historical setup linked the
# entire directory to DSH's workspace; remove only that generated symlink.
if [[ -L "$plugin_modules" ]]; then
  unlink "$plugin_modules"
fi

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

# Host peers and browser-injected type packages must come from this exact DSH
# checkout in source mode, not another version resolved by the package manager.
dsh_development_peers=(
  cordis
  dsh-api-remotes
  dsh-client-locale
  dsh-client-runtime
  dsh-client-ui-conversation
  dsh-client-ui-primitives
  dsh-client-ui-settings
  dsh-client-ui-slots
  dsh-client-ui-theme
  dsh-llm
  dsh-session
  dsh-tools
  dsh-typert-protocol
)
mkdir -p "$plugin_modules/@deepseek-ai"
for peer in "${dsh_development_peers[@]}"; do
  peer_source="$dsh_root/node_modules/.pnpm/node_modules/@deepseek-ai/$peer"
  peer_target="$plugin_modules/@deepseek-ai/$peer"
  if [[ ! -e "$peer_source" ]]; then
    printf 'Missing DSH workspace peer: %s\n' "$peer_source" >&2
    exit 1
  fi
  rm -rf "$peer_target"
  ln -s "$peer_source" "$peer_target"
done

if [[ ! -d "$relay_root/node_modules/@xterm/xterm" ]]; then
  printf 'Relay plugin dependencies were not installed correctly.\n' >&2
  exit 1
fi

(
  cd "$plugin_root"
  npm run build
)

build_marker="$dsh_root/node_modules/.cache/relay-dsh-build-commit"
if [[ ! -f "$dsh_root/apps/web/dist/index.html" \
  || ! -f "$dsh_root/apps/cli/lib/bin.js" \
  || ! -f "$build_marker" \
  || "$(<"$build_marker")" != "$dsh_commit" ]]; then
  pnpm --dir "$dsh_root" run build
  mkdir -p "$(dirname "$build_marker")"
  printf '%s\n' "$dsh_commit" > "$build_marker"
fi

pnpm --dir "$dsh_root" dsh plugin --profile web add "$plugin_root"

# The source-mode DSH loader resolves plugin names from the upstream workspace.
plugin_link="$dsh_root/node_modules/relay-dsh-plugin"
if [[ ! -e "$plugin_link" && ! -L "$plugin_link" ]]; then
  ln -s "$plugin_root" "$plugin_link"
fi

# DSH dynamically imports this client package outside its source aliases.
picker_link="$dsh_root/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-native"
if [[ ! -e "$picker_link" && ! -L "$picker_link" ]]; then
  ln -s ../../packages/client/ui-directory-picker-native "$picker_link"
fi

cd "$dsh_root"
exec node --expose-internals --import tsx/esm apps/cli/src/bin.ts web "$@"
