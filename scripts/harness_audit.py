#!/usr/bin/env python3
"""Harness engineering audit — Python wrapper for programmatic use."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run_audit(repo_path: str = ".") -> int:
    """Run the harness audit script and return exit code."""
    script = Path(__file__).resolve().parent / "audit_harness.sh"
    if not script.exists():
        print(f"error: audit script not found: {script}", file=sys.stderr)
        return 2

    result = subprocess.run(
        ["bash", str(script), repo_path],
        check=False,
    )
    return result.returncode


def main() -> None:
    repo_path = sys.argv[1] if len(sys.argv) > 1 else "."
    sys.exit(run_audit(repo_path))


if __name__ == "__main__":
    main()
