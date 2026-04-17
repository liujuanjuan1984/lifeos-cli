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

if [ -z "${LIFEOS_TEST_DATABASE_URL:-}" ]; then
  echo "[integration] skipped: set LIFEOS_TEST_DATABASE_URL to run PostgreSQL CLI integration tests" >&2
  exit 3
fi

uv run pytest -m integration tests/test_cli_integration_*.py
