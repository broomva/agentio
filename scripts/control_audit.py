#!/usr/bin/env python3
"""Control metalayer audit — Python wrapper for programmatic use."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run_audit(repo_path: str = ".", strict: bool = False) -> int:
    """Run the control audit script and return exit code."""
    script = Path(__file__).resolve().parent / "audit_control.sh"
    if not script.exists():
        print(f"error: audit script not found: {script}", file=sys.stderr)
        return 2

    args = ["bash", str(script), repo_path]
    if strict:
        args.append("--strict")

    result = subprocess.run(args, check=False)
    return result.returncode


def main() -> None:
    repo_path = sys.argv[1] if len(sys.argv) > 1 else "."
    strict = "--strict" in sys.argv
    sys.exit(run_audit(repo_path, strict=strict))


if __name__ == "__main__":
    main()
