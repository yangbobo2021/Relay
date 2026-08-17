#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_root="$relay_root/upstream/deepseek-harness"
plugin_root="$relay_root/integrations/deepseek-harness"
plugin_modules="$plugin_root/node_modules"

"$relay_root/scripts/install-dsh-presets.sh"

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
