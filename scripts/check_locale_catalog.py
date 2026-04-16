"""Validate or update compiled gettext catalogs tracked in the repository."""

from __future__ import annotations

import argparse
import sys
from io import BytesIO
from pathlib import Path

from babel.messages import mofile, pofile

REPO_ROOT = Path(__file__).resolve().parents[1]
LOCALES_DIR = REPO_ROOT / "src" / "lifeos_cli" / "locales"


def _iter_catalog_pairs() -> list[tuple[Path, Path]]:
    return sorted((po_path, po_path.with_suffix(".mo")) for po_path in LOCALES_DIR.rglob("*.po"))


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
    if not failures:
        return 0
    print("\n".join(failures), file=sys.stderr)
    print(
        "Run `uv run python scripts/check_locale_catalog.py --write` "
        "and commit the updated .mo files.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
