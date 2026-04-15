#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p static

python3 - <<'PY'
import json
import subprocess
from pathlib import Path

files = subprocess.check_output(
    ["git", "ls-files", "*.md"],
    text=True,
).splitlines()

updated = {}
for file_path in files:
    ts = subprocess.check_output(
        ["git", "log", "-1", "--format=%ct", "--", file_path],
        text=True,
    ).strip()
    if ts:
        updated[file_path] = int(ts)

target = Path("static/last-updated.json")
target.write_text(
    json.dumps(dict(sorted(updated.items())), ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
PY

echo "Generated static/last-updated.json"
