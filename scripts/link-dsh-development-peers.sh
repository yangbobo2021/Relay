#!/usr/bin/env bash
set -euo pipefail

relay_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_root="$relay_root/upstream/deepseek-harness"
target_root="$relay_root/node_modules/@deepseek-ai"

mkdir -p "$target_root"
for source in "$dsh_root/node_modules/.pnpm/node_modules/@deepseek-ai/"*; do
  peer="$(basename "$source")"
  target="$target_root/$peer"
  rm -rf "$target"
  ln -s "$source" "$target"
done
