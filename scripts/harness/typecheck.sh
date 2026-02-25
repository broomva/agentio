#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

echo "--- Running type checks ---"
if [ -f turbo.json ]; then
  bunx turbo run typecheck --no-daemon 2>&1 || {
    echo "Typecheck failed." >&2
    exit 1
  }
elif [ -f tsconfig.json ] || [ -f tsconfig.base.json ]; then
  bunx tsc --noEmit
else
  echo "No TypeScript configuration found; skipping."
  exit 0
fi

echo "Typecheck passed."
