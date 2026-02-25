#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

echo "--- Smoke: build ---"
if [ -f turbo.json ]; then
  bunx turbo run build --no-daemon 2>&1 || {
    echo "Build failed." >&2
    exit 1
  }
else
  echo "No turbo.json found; skipping turbo build."
fi

echo "--- Smoke: quick lint ---"
if [ -x scripts/harness/lint.sh ]; then
  bash scripts/harness/lint.sh
fi

echo "Smoke check passed."
