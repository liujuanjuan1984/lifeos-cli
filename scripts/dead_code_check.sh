#!/usr/bin/env bash
set -euo pipefail

uv run vulture \
  src \
  tests \
  scripts/vulture_whitelist.py \
  --min-confidence 60 \
  --ignore-names "down_revision,branch_labels,depends_on,downgrade,pytestmark"
