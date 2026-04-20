#!/usr/bin/env bash
set -euo pipefail

source ./scripts/load_local_env.sh
load_local_env "./.env"

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
