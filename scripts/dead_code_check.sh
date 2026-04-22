#!/usr/bin/env bash
set -euo pipefail

FRAMEWORK_IGNORE_NAMES="down_revision,branch_labels,depends_on,downgrade,pytestmark,ngettext"

# Vulture cannot resolve a few framework-owned entrypoints by static reference:
# - Alembic revision metadata and downgrade functions
# - module-level pytestmark declarations
# Keep these explicit name-based ignores here. All other intentional framework-driven symbols
# should stay documented in scripts/vulture_whitelist.py.

uv run vulture \
  src \
  tests \
  scripts/vulture_whitelist.py \
  --min-confidence 60 \
  --ignore-names "${FRAMEWORK_IGNORE_NAMES}"
