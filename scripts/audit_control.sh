#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: audit_control.sh [repo_path] [--strict]

Audit a repository for control metalayer artifacts.

Options:
  --strict    Also check for advanced control primitives (e2e, nightly, hooks)
EOF
}

target_path="."
strict=0

while [ $# -gt 0 ]; do
  case "$1" in
    --strict)
      strict=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      target_path="$1"
      ;;
  esac
  shift
done

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

echo "Auditing control metalayer in: $target_path"
echo

# Core metalayer files
check_file "METALAYER.md"
check_file ".control/policy.yaml"
check_file ".control/commands.yaml"
check_file ".control/topology.yaml"
check_file "Makefile.control"
check_file "scripts/audit_control.sh"
check_file "scripts/control/recover.sh"

echo
# Content checks
check_contains "METALAYER.md" "Control System Model" "METALAYER.md: control system model"
check_contains "METALAYER.md" "Escalation Rules" "METALAYER.md: escalation rules"
check_contains "METALAYER.md" "Stable Command Surface" "METALAYER.md: stable commands"
check_contains ".control/policy.yaml" "approval_required" "policy.yaml: approval rules"
check_contains ".control/commands.yaml" "smoke:" "commands.yaml: smoke command"
check_contains ".control/commands.yaml" "ci:" "commands.yaml: ci command"
check_contains "Makefile.control" "^recover:" "Makefile.control: recover target"

if [ "$strict" -eq 1 ]; then
  echo
  echo "--- Strict checks ---"
  check_file "scripts/control/web_e2e.sh"
  check_file "scripts/control/cli_e2e.sh"
  check_file ".github/workflows/control-nightly.yml"
  check_file ".github/workflows/web-e2e.yml"
  check_file ".github/workflows/cli-e2e.yml"
  check_contains "Makefile.control" "^web-e2e:" "Makefile.control: web-e2e target"
  check_contains "Makefile.control" "^cli-e2e:" "Makefile.control: cli-e2e target"
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "Control audit failed: $failures issue(s) detected."
  exit 1
fi

echo "Control audit passed."
