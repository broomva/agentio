#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

echo "--- Running tests ---"
if [ -f turbo.json ]; then
  bunx turbo run test --no-daemon 2>&1 || {
    echo "Tests failed." >&2
    exit 1
  }
elif [ -f package.json ] && grep -q '"test"' package.json; then
  bun test
else
  echo "No test configuration found."
  exit 0
fi

echo "All tests passed."
