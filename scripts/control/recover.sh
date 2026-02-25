#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"

echo "--- Automated Recovery ---"

# Step 1: Clean build artifacts
echo "Cleaning build artifacts..."
rm -rf node_modules/.cache .turbo dist/

# Step 2: Reinstall dependencies
echo "Reinstalling dependencies..."
bun install

# Step 3: Rebuild
echo "Rebuilding..."
if [ -f turbo.json ]; then
  bunx turbo run build --no-daemon --force
fi

# Step 4: Run smoke check
echo "Running smoke check..."
bash scripts/harness/smoke.sh

echo "Recovery complete."
