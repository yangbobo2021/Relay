#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dsh_dir="$repo_root/upstream/deepseek-harness"
dsh_url="https://github.com/deepseek-ai/deepseek-harness.git"
disabled_push_url="disabled://relay-read-only/deepseek-harness"

if [ -d "$dsh_dir/.git" ]; then
  if [ -n "$(git -C "$dsh_dir" status --porcelain --untracked-files=all)" ]; then
    printf 'DSH checkout is not clean; refusing to overwrite official source.\n' >&2
    exit 1
  fi
  if git -C "$dsh_dir" remote get-url origin >/dev/null 2>&1; then
    git -C "$dsh_dir" remote set-url origin "$dsh_url"
  else
    git -C "$dsh_dir" remote add origin "$dsh_url"
  fi
  if git -C "$dsh_dir" remote get-url upstream >/dev/null 2>&1; then
    git -C "$dsh_dir" remote remove upstream
  fi
else
  git clone --depth 1 "$dsh_url" "$dsh_dir"
fi

git -C "$dsh_dir" remote set-url --push origin "$disabled_push_url"
git -C "$dsh_dir" remote prune origin
git -C "$dsh_dir" fetch --depth 1 origin master
git -C "$dsh_dir" checkout --detach FETCH_HEAD

if [ -n "$(git -C "$dsh_dir" status --porcelain --untracked-files=all)" ]; then
  printf 'DSH checkout changed during synchronization.\n' >&2
  exit 1
fi

git -C "$dsh_dir" rev-parse HEAD
