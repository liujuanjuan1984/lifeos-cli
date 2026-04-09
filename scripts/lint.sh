#!/usr/bin/env bash
set -euo pipefail

echo "[lint] run pre-commit"
uv run pre-commit run --all-files
