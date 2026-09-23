#!/usr/bin/env python3
"""Type-check and exercise the photography reference model with isolated fixtures."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    for tool in ("node", "tsc"):
        if shutil.which(tool) is None:
            print(f"Required tool is not installed: {tool}", file=sys.stderr)
            return 2
    with tempfile.TemporaryDirectory(prefix="portfolio-photo-check-") as temporary:
        compilation = subprocess.run(
            ["tsc", str(ROOT / "reference/photography-model.ts"),
             "--strict", "--target", "ES2022", "--module", "commonjs",
             "--outDir", temporary, "--skipLibCheck"],
            capture_output=True, text=True, timeout=60,
        )
        if compilation.returncode:
            print(compilation.stdout + compilation.stderr, file=sys.stderr)
            return compilation.returncode
        tests = subprocess.run(
            ["node", str(ROOT / "reference/photography-model.test.mjs"),
             str(Path(temporary) / "photography-model.js"),
             str(ROOT / "reference/fixtures/photography.test.json"),
             str(ROOT / "data/photography.json")],
            capture_output=True, text=True, timeout=30,
        )
        if tests.stdout:
            report = json.loads(tests.stdout)
            report["typecheck"] = {"passed": True, "strict": True, "target": "ES2022"}
            print(json.dumps(report, indent=2, ensure_ascii=False))
        if tests.stderr:
            print(tests.stderr, file=sys.stderr)
        return tests.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        print(f"Reference checks could not complete: {error}", file=sys.stderr)
        raise SystemExit(2)
