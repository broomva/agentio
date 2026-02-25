#!/usr/bin/env bash
set -euo pipefail

root_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root_dir"

failures=0

check_exists() {
  local rel="$1"
  if [ -e "$rel" ]; then
    echo "[ok]      $rel"
  else
    echo "[missing] $rel"
    failures=$((failures + 1))
  fi
}

check_not_contains() {
  local rel="$1"
  local pattern="$2"
  local label="$3"
  if [ ! -f "$rel" ]; then
    echo "[missing] $label (file missing: $rel)"
    failures=$((failures + 1))
    return
  fi
  if grep -En "$pattern" "$rel" >/dev/null 2>&1; then
    echo "[drift]   $label"
    failures=$((failures + 1))
  else
    echo "[ok]      $label"
  fi
}

echo "Entropy check: $root_dir"
echo

# Core files exist
check_exists "AGENTS.md"
check_exists "PLANS.md"
check_exists "METALAYER.md"
check_exists "docs/ARCHITECTURE.md"
check_exists "docs/OBSERVABILITY.md"
check_exists "Makefile.harness"
check_exists "Makefile.control"
check_exists ".control/policy.yaml"
check_exists ".control/commands.yaml"
check_exists ".control/topology.yaml"

# Check for uncustomized placeholder patterns
check_not_contains "AGENTS.md" "<project-name>|<runtime>|<entrypoints>" "AGENTS.md placeholders removed"
check_not_contains "PLANS.md" "^- Outcome:$" "PLANS.md has content (not blank template)"

echo
if [ "$failures" -gt 0 ]; then
  echo "Entropy check failed: $failures issue(s)."
  exit 1
fi
echo "Entropy check passed."

# Update state.json on success
state_file="$root_dir/.control/state.json"
if [ -f "$state_file" ]; then
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  tmp_file=$(mktemp)
  if command -v python3 &>/dev/null; then
    python3 -c "
import json
with open('$state_file') as f:
    state = json.load(f)
state['last_entropy_review_at'] = '$now'
with open('$tmp_file', 'w') as f:
    json.dump(state, f, indent=2)
    f.write('\n')
"
    mv "$tmp_file" "$state_file"
    echo "Updated .control/state.json last_entropy_review_at → $now"
  else
    rm -f "$tmp_file"
  fi
fi
