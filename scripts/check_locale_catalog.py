"""Validate JSON locale catalogs tracked in the repository."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = REPO_ROOT / "src" / "lifeos_cli" / "locales"
DEFAULT_JSON_LOCALE = "en"


def _flatten_json_catalog_keys(catalog: dict[str, Any]) -> dict[str, str]:
    flattened: dict[str, str] = {}

    def _visit(node: Any, prefix: tuple[str, ...]) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                _visit(value, (*prefix, str(key)))
            return
        dotted_key = ".".join(prefix)
        if isinstance(node, str) and node:
            flattened[dotted_key] = node
            return
        flattened[dotted_key] = ""

    _visit(catalog, ())
    return flattened


def _load_json_catalog(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as catalog_file:
        catalog = json.load(catalog_file)
    if not isinstance(catalog, dict):
        raise ValueError(f"JSON catalog must contain an object: {path.relative_to(REPO_ROOT)}")
    return catalog


def _iter_json_catalog_paths() -> list[Path]:
    return sorted(LOCALES_DIR.glob("*/*.json"))


def _check_json_catalogs() -> list[str]:
    failures: list[str] = []
    json_catalogs = _iter_json_catalog_paths()
    locale_names = sorted(path.name for path in LOCALES_DIR.iterdir() if path.is_dir())
    grouped_paths: dict[str, dict[str, Path]] = {}
    for path in json_catalogs:
        locale_name = path.parent.name
        grouped_paths.setdefault(path.name, {})[locale_name] = path

    for catalog_name, locale_paths in sorted(grouped_paths.items()):
        default_path = locale_paths.get(DEFAULT_JSON_LOCALE)
        if default_path is None:
            failures.append(f"Missing default JSON catalog for {catalog_name}")
            continue
        default_keys = set(_flatten_json_catalog_keys(_load_json_catalog(default_path)))
        missing_locale_names = sorted(set(locale_names) - set(locale_paths))
        for locale_name in missing_locale_names:
            failures.append(f"Missing JSON catalog for {locale_name}: {catalog_name}")
        for path in sorted(locale_paths.values()):
            keys_to_values = _flatten_json_catalog_keys(_load_json_catalog(path))
            keys = set(keys_to_values)
            missing_keys = sorted(default_keys - keys)
            extra_keys = sorted(keys - default_keys)
            empty_keys = sorted(key for key, value in keys_to_values.items() if not value)
            if missing_keys:
                failures.append(
                    f"{path.relative_to(REPO_ROOT)} missing keys: {', '.join(missing_keys)}"
                )
            if extra_keys:
                failures.append(
                    f"{path.relative_to(REPO_ROOT)} has extra keys: {', '.join(extra_keys)}"
                )
            if empty_keys:
                failures.append(
                    f"{path.relative_to(REPO_ROOT)} has empty values: {', '.join(empty_keys)}"
                )
    return failures


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    return parser.parse_args()


def main() -> int:
    _parse_args()
    failures = _check_json_catalogs()
    if not failures:
        return 0
    print("\n".join(failures), file=sys.stderr)
    print(
        "Fix JSON catalog key drift and commit the locale files.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
