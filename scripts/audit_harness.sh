#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: audit_harness.sh [repo_path]

Audit a repository for baseline harness engineering artifacts.
EOF
}

target_path="${1:-.}"
if [ "$target_path" = "-h" ] || [ "$target_path" = "--help" ]; then
  usage
  exit 0
fi

if [ ! -d "$target_path" ]; then
  echo "error: target path does not exist: $target_path" >&2
  exit 1
fi

target_path=$(cd "$target_path" && pwd)
failures=0

ok() {
  echo "[ok]      $1"
}

fail() {
  echo "[missing] $1"
  failures=$((failures + 1))
}

check_file() {
  local relative="$1"
  if [ -f "$target_path/$relative" ]; then
    ok "$relative"
  else
    fail "$relative"
  fi
}

check_contains() {
  local relative="$1"
  local pattern="$2"
  local label="$3"
  local full="$target_path/$relative"

  if [ ! -f "$full" ]; then
    fail "$label (file missing: $relative)"
    return
  fi

  if grep -Eq "$pattern" "$full"; then
    ok "$label"
  else
    fail "$label"
  fi
}

echo "Auditing harness artifacts in: $target_path"
echo

# Core files
check_file "AGENTS.md"
check_file "PLANS.md"
check_file "docs/ARCHITECTURE.md"
check_file "docs/OBSERVABILITY.md"
check_file "Makefile.harness"
check_file "scripts/audit_harness.sh"
check_file "scripts/harness/smoke.sh"
check_file "scripts/harness/test.sh"
check_file "scripts/harness/lint.sh"
check_file "scripts/harness/typecheck.sh"
check_file ".github/workflows/harness.yml"

echo
# Content checks
check_contains "AGENTS.md" "Harness Commands" "AGENTS.md: Harness Commands section"
check_contains "AGENTS.md" "Execution Plans" "AGENTS.md: Execution Plans section"
check_contains "docs/ARCHITECTURE.md" "Boundaries" "ARCHITECTURE.md: boundary guidance"
check_contains "docs/OBSERVABILITY.md" "Required Event Fields" "OBSERVABILITY.md: required fields"
check_contains "Makefile.harness" "^smoke:" "Makefile.harness: smoke target"
check_contains "Makefile.harness" "^test:" "Makefile.harness: test target"
check_contains "Makefile.harness" "^lint:" "Makefile.harness: lint target"
check_contains "Makefile.harness" "^typecheck:" "Makefile.harness: typecheck target"
check_contains "Makefile.harness" "^ci:" "Makefile.harness: ci target"
check_contains ".github/workflows/harness.yml" "make ci" "CI workflow executes make ci"

echo
echo "--- Runtime correctness checks ---"

# Check: kernel packages have test files
kernel_test_ok=true
for pkg in protocol kernel-run kernel-policy kernel-artifact kernel-state; do
  pkg_dir="$target_path/packages/$pkg"
  if [ -d "$pkg_dir" ]; then
    test_count=$(find "$pkg_dir/__tests__" -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$test_count" -gt 0 ]; then
      ok "packages/$pkg has test files ($test_count)"
    else
      fail "packages/$pkg has no test files"
      kernel_test_ok=false
    fi
  fi
done

# Check: all test files use bun:test (not node:test)
echo
node_test_files=$(grep -rl 'from "node:test"' "$target_path/packages" "$target_path/apps" 2>/dev/null || true)
if [ -z "$node_test_files" ]; then
  ok "All test files use bun:test (no node:test imports found)"
else
  fail "Test files using node:test instead of bun:test:"
  echo "$node_test_files" | while read -r f; do
    echo "       - ${f#$target_path/}"
  done
fi

# Check: kernel purity (no node:fs/node:path imports in kernel-*)
echo
kernel_impure=false
for pkg_dir in "$target_path"/packages/kernel-*; do
  if [ -d "$pkg_dir/src" ]; then
    impure_imports=$(grep -rn 'from "node:fs\|from "node:path\|require("node:fs\|require("node:path' "$pkg_dir/src" 2>/dev/null || true)
    if [ -n "$impure_imports" ]; then
      fail "Kernel purity: $(basename "$pkg_dir")/src has I/O imports"
      echo "$impure_imports" | head -5
      kernel_impure=true
    fi
  fi
done
if [ "$kernel_impure" = false ]; then
  ok "Kernel purity: no node:fs/node:path imports in kernel-* packages"
fi

# Check: integration test package exists
if [ -d "$target_path/packages/kernel-integration" ] && [ -d "$target_path/packages/kernel-integration/__tests__" ]; then
  int_test_count=$(find "$target_path/packages/kernel-integration/__tests__" -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$int_test_count" -gt 0 ]; then
    ok "Integration test package exists with $int_test_count test files"
  else
    fail "Integration test package exists but has no test files"
  fi
else
  fail "Integration test package (packages/kernel-integration) not found"
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "Harness audit failed: $failures issue(s) detected."
  exit 1
fi

echo "Harness audit passed."

# Update state.json on success
state_file="$target_path/.control/state.json"
if [ -f "$state_file" ]; then
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  # Use a temp file for safe in-place update
  tmp_file=$(mktemp)
  if command -v python3 &>/dev/null; then
    python3 -c "
import json, sys
with open('$state_file') as f:
    state = json.load(f)
state['last_audit_at'] = '$now'
with open('$tmp_file', 'w') as f:
    json.dump(state, f, indent=2)
    f.write('\n')
"
    mv "$tmp_file" "$state_file"
    echo "Updated .control/state.json last_audit_at → $now"
  else
    rm -f "$tmp_file"
  fi
fi
