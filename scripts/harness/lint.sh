#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

echo "--- Running linters ---"
if [ -f turbo.json ]; then
  pnpm turbo run lint --no-daemon 2>&1 || {
    echo "Lint failed." >&2
    exit 1
  }
elif command -v eslint >/dev/null 2>&1; then
  eslint .
elif [ -f package.json ] && grep -q '"lint"' package.json; then
  pnpm lint
else
  echo "No lint configuration found; skipping."
  exit 0
fi

echo "Lint passed."
