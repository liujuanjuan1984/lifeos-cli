#!/usr/bin/env bash
set -euo pipefail

echo "[doctor] sync dependencies"
uv sync --all-extras

echo "[doctor] run lint"
uv run pre-commit run --all-files

echo "[doctor] run tests"
uv run pytest
