#!/usr/bin/env bash
set -euo pipefail

if [ -z "${LIFEOS_TEST_DATABASE_URL:-}" ]; then
  echo "[integration] skip: set LIFEOS_TEST_DATABASE_URL to run CLI integration tests" >&2
  exit 0
fi

uv run pytest -m integration tests/test_cli_integration_*.py
