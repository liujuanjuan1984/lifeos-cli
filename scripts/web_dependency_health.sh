#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}/web"

echo "[web-dependency-health] install locked dependencies"
npm ci

echo "[web-dependency-health] list outdated packages"
npm outdated --long || true

echo "[web-dependency-health] run frontend dependency vulnerability audit"
npm audit --audit-level=low
