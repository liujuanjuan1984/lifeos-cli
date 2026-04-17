#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_ENV_FILE="${REPO_ROOT}/.env"

if [ -f "${LOCAL_ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${LOCAL_ENV_FILE}"
  set +a
fi

echo "[doctor] sync dependencies"
uv sync --all-extras --frozen

echo "[doctor] run lint"
uv run pre-commit run --all-files

echo "[doctor] run tests"
uv run pytest -m "not integration"

echo "[doctor] export runtime requirements"
uv export --format requirements.txt --no-dev --locked --no-emit-project \
  --output-file /tmp/runtime-requirements.txt >/dev/null

echo "[doctor] run runtime dependency vulnerability audit"
uv run pip-audit --requirement /tmp/runtime-requirements.txt

echo "[doctor] clean build artifacts"
rm -rf build dist

echo "[doctor] build package artifacts"
uv build --no-sources

echo "[doctor] run integration tests"
integration_status="passed"
if bash ./scripts/integration_tests.sh; then
  :
else
  status=$?
  if [ "$status" -eq 3 ]; then
    integration_status="skipped"
    echo "[doctor] integration tests skipped: PostgreSQL CLI coverage requires LIFEOS_TEST_DATABASE_URL" >&2
  else
    exit "$status"
  fi
fi

if [ "$integration_status" = "skipped" ]; then
  echo "[doctor] completed without PostgreSQL CLI integration coverage" >&2
else
  echo "[doctor] completed with PostgreSQL CLI integration coverage"
fi
