"""Validate gettext and JSON locale catalogs tracked in the repository."""

from __future__ import annotations

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path
from typing import Any

from babel.messages import mofile, pofile

REPO_ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = REPO_ROOT / "src" / "lifeos_cli" / "locales"
DEFAULT_JSON_LOCALE = "en"


def _iter_catalog_pairs() -> list[tuple[Path, Path]]:
    return sorted((po_path, po_path.with_suffix(".mo")) for po_path in LOCALES_DIR.rglob("*.po"))


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


def _build_mo_bytes(po_path: Path) -> bytes:
    with po_path.open("r", encoding="utf-8") as po_file:
        catalog = pofile.read_po(po_file)
    output = BytesIO()
    mofile.write_mo(output, catalog, use_fuzzy=False)
    return output.getvalue()


def _write_catalog(po_path: Path, mo_path: Path) -> bool:
    expected_bytes = _build_mo_bytes(po_path)
    current_bytes = mo_path.read_bytes() if mo_path.exists() else None
    if current_bytes == expected_bytes:
        return False
    mo_path.write_bytes(expected_bytes)
    return True


def _check_catalog(po_path: Path, mo_path: Path) -> str | None:
    if not mo_path.exists():
        return f"Missing compiled catalog: {mo_path.relative_to(REPO_ROOT)}"
    expected_bytes = _build_mo_bytes(po_path)
    current_bytes = mo_path.read_bytes()
    if current_bytes != expected_bytes:
        return (
            "Out-of-sync compiled catalog: "
            f"{mo_path.relative_to(REPO_ROOT)} does not match {po_path.relative_to(REPO_ROOT)}"
        )
    return None


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
    parser.add_argument(
        "--write",
        action="store_true",
        help="Rewrite tracked .mo files from their matching .po files",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    catalog_pairs = _iter_catalog_pairs()
    if args.write:
        updated_count = sum(
            1 for po_path, mo_path in catalog_pairs if _write_catalog(po_path, mo_path)
        )
        print(f"Updated {updated_count} compiled locale catalogs.")
        return 0

    failures = [
        message
        for po_path, mo_path in catalog_pairs
        if (message := _check_catalog(po_path, mo_path)) is not None
    ]
    failures.extend(_check_json_catalogs())
    if not failures:
        return 0
    print("\n".join(failures), file=sys.stderr)
    print(
        "Run `uv run python scripts/check_locale_catalog.py --write` for gettext .mo drift, "
        "then fix any JSON catalog key drift and commit the locale files.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
