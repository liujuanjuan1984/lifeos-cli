#!/usr/bin/env bash
set -euo pipefail

find . -type d -name "__pycache__" -prune -exec rm -rf {} +
find . -type d \( -name "*.egg-info" -o -name ".pytest_cache" -o -name ".mypy_cache" -o -name ".ruff_cache" \) -prune -exec rm -rf {} +
rm -rf build dist htmlcov .coverage .coverage.*
