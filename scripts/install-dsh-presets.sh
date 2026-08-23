#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_home="${DSH_HOME:-$HOME/.dsh}"

install_relay_preset() {
  local preset_name="$1"
  local backend="${preset_name#relay-}"
  local preset_source="$relay_root/integrations/dsh-$backend/presets/$preset_name"
  local preset_dir="$dsh_home/.agent-presets/$preset_name"

  mkdir -p "$(dirname "$preset_dir")"
  if [[ -L "$preset_dir" && "$(readlink "$preset_dir")" == "$preset_source" ]]; then
    rm "$preset_dir"
  fi
  if [[ ! -e "$preset_dir" ]]; then
    mkdir -p "$preset_dir"
  elif [[ ! -f "$preset_dir/.relay-managed" ]]; then
    printf 'Relay preset not installed: %s already exists and is not Relay-managed\n' "$preset_dir" >&2
    return
  fi

  cp "$preset_source/agent.cordis.yml" "$preset_source/preset.yml" "$preset_source/.relay-managed" "$preset_dir/"
}

install_relay_preset relay-codex
install_relay_preset relay-claude
