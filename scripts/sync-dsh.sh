#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_dir="$repo_root/upstream/deepseek-harness"
dsh_url="https://github.com/deepseek-ai/deepseek-harness"

if [ -d "$dsh_dir/.git" ]; then
  git -C "$dsh_dir" fetch --depth 1 origin main
  git -C "$dsh_dir" checkout FETCH_HEAD
else
  git clone --depth 1 "$dsh_url" "$dsh_dir"
fi

git -C "$dsh_dir" rev-parse HEAD
