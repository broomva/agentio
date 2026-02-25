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
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
elif [ -f package-lock.json ]; then
  npm ci
fi

# Step 3: Rebuild
echo "Rebuilding..."
if [ -f turbo.json ]; then
  pnpm turbo run build --no-daemon --force
fi

# Step 4: Run smoke check
echo "Running smoke check..."
bash scripts/harness/smoke.sh

echo "Recovery complete."
