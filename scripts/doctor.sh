#!/usr/bin/env bash
set -euo pipefail

echo "[doctor] sync dependencies"
if [ "${CI:-}" = "true" ]; then
  uv sync --all-extras --frozen
else
  uv sync --all-extras
fi

echo "[doctor] run lint"
uv run pre-commit run --all-files

echo "[doctor] run tests"
uv run pytest -m "not integration"

echo "[doctor] run integration tests"
bash ./scripts/integration_tests.sh
