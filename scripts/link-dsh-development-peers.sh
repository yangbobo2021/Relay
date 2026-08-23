#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_root="$relay_root/upstream/deepseek-harness"
target_root="$relay_root/node_modules/@deepseek-ai"

peers=(
  cordis dsh-api-remotes dsh-client-connection dsh-client-locale
  dsh-client-runtime dsh-client-ui-conversation dsh-client-ui-primitives
  dsh-client-ui-settings dsh-client-ui-slots dsh-client-ui-theme dsh-llm
  dsh-session dsh-tools dsh-typert-protocol
)

mkdir -p "$target_root"
for peer in "${peers[@]}"; do
  source="$dsh_root/node_modules/.pnpm/node_modules/@deepseek-ai/$peer"
  target="$target_root/$peer"
  if [[ ! -e "$source" ]]; then
    printf 'Missing DSH workspace peer: %s\n' "$source" >&2
    exit 1
  fi
  rm -rf "$target"
  ln -s "$source" "$target"
done
