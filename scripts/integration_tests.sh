#!/usr/bin/env bash
set -euo pipefail

if [ "${LIFEOS_RUN_INTEGRATION:-}" != "1" ]; then
  echo "[integration] skip: set LIFEOS_RUN_INTEGRATION=1 to run CLI integration tests"
  exit 0
fi

if [ -z "${LIFEOS_TEST_DATABASE_URL:-}" ] && [ -z "${LIFEOS_DATABASE_URL:-}" ]; then
  echo "[integration] LIFEOS_RUN_INTEGRATION=1 requires LIFEOS_TEST_DATABASE_URL or LIFEOS_DATABASE_URL" >&2
  exit 1
fi

uv run pytest -m integration tests/test_cli_integration_*.py
