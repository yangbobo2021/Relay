#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_root="$relay_root/upstream/deepseek-harness"
plugin_root="$relay_root/integrations/deepseek-harness"
plugin_modules="$plugin_root/node_modules"
dsh_home="${DSH_HOME:-$HOME/.dsh}"
relay_preset_dir="$dsh_home/.agent-presets/relay-codex"
relay_preset_source="$plugin_root/presets/relay-codex"

mkdir -p "$(dirname "$relay_preset_dir")"
if [[ -L "$relay_preset_dir" && "$(readlink "$relay_preset_dir")" == "$relay_preset_source" ]]; then
  rm "$relay_preset_dir"
fi
if [[ ! -e "$relay_preset_dir" ]]; then
  mkdir -p "$relay_preset_dir"
  cp "$relay_preset_source/agent.cordis.yml" "$relay_preset_source/preset.yml" "$relay_preset_source/.relay-managed" "$relay_preset_dir/"
elif [[ -f "$relay_preset_dir/.relay-managed" ]]; then
  cp "$relay_preset_source/agent.cordis.yml" "$relay_preset_source/preset.yml" "$relay_preset_source/.relay-managed" "$relay_preset_dir/"
else
  printf 'Relay Codex preset not installed: %s already exists and is not Relay-managed\n' "$relay_preset_dir" >&2
fi

# The Relay plugin is developed outside DSH's pnpm workspace but uses its exact
# runtime and browser build dependencies.
if [[ ! -e "$plugin_modules" && ! -L "$plugin_modules" ]]; then
  ln -s "$dsh_root/node_modules/.pnpm/node_modules" "$plugin_modules"
fi

(
  cd "$plugin_root"
  "$dsh_root/node_modules/.bin/tsdown" --config tsdown.config.ts
)

if [[ ! -f "$dsh_root/apps/web/dist/index.html" || ! -f "$dsh_root/apps/cli/lib/bin.js" ]]; then
  pnpm --dir "$dsh_root" run build
fi

pnpm --dir "$dsh_root" dsh plugin --profile web add "$plugin_root"

# The source-mode DSH loader resolves plugin names from the upstream workspace.
plugin_link="$dsh_root/node_modules/relay-dsh-plugin"
if [[ ! -e "$plugin_link" && ! -L "$plugin_link" ]]; then
  ln -s "$plugin_root" "$plugin_link"
fi

# DSH rc.5 dynamically imports this client package outside its source aliases.
picker_link="$dsh_root/node_modules/@deepseek-ai/dsh-client-ui-directory-picker-native"
if [[ ! -e "$picker_link" && ! -L "$picker_link" ]]; then
  ln -s ../../packages/client/ui-directory-picker-native "$picker_link"
fi

cd "$dsh_root"
exec node --expose-internals --import tsx/esm apps/cli/src/bin.ts web "$@"
