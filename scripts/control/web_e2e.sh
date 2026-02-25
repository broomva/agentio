#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

# Allow override via environment variable
if [ -n "${CONTROL_WEB_E2E_CMD:-}" ]; then
  eval "$CONTROL_WEB_E2E_CMD"
  exit 0
fi

# Check for Playwright config
if [ -f playwright.config.ts ] || [ -f playwright.config.js ]; then
  npx playwright test
  exit 0
fi

# Check for custom e2e test script
if [ -x ./tests/e2e/web/run.sh ]; then
  ./tests/e2e/web/run.sh
  exit 0
fi

echo "No web E2E command configured. Set CONTROL_WEB_E2E_CMD or add playwright.config.ts." >&2
exit 1
