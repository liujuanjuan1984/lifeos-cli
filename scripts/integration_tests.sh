#!/usr/bin/env bash
set -euo pipefail

uv run pytest -m integration tests/test_cli_integration_*.py
