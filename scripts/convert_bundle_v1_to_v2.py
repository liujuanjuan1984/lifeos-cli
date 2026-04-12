#!/usr/bin/env python3
"""Convert legacy v1 bundles into v2 bundles after sparse habit-action materialization."""

from __future__ import annotations

from collections.abc import Sequence
import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

from lifeos_cli.db.services.data_ops import BUNDLE_RESOURCE_ORDER, BUNDLE_SCHEMA_VERSION


def build_parser() -> argparse.ArgumentParser:
    """Build the legacy bundle conversion CLI parser."""
    parser = argparse.ArgumentParser(
        prog="convert_bundle_v1_to_v2.py",
        description=(
            "Convert a legacy v1 data bundle into the current v2 bundle format.\n\n"
            "This one-time migration tool drops placeholder habit-action rows that existed only "
            "to support dense pre-generation in older releases."
        ),
    )
    parser.add_argument(
        "input_bundle",
        type=Path,
        help="Path to the legacy v1 bundle zip file",
    )
    parser.add_argument(
        "output_bundle",
        type=Path,
        help="Path for the converted v2 bundle zip file",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing output bundle",
    )
    return parser


def _read_legacy_bundle(path: Path) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    try:
        with ZipFile(path, "r") as archive:
            if "manifest.json" not in archive.namelist():
                raise ValueError("Bundle archive is missing manifest.json.")
            manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            if not isinstance(manifest, dict):
                raise ValueError("Bundle manifest must be a JSON object.")
            schema_version = manifest.get("schema_version")
            if schema_version != 1:
                raise ValueError(
                    f"Expected a legacy v1 bundle, but found schema_version={schema_version!r}."
                )
            resources: dict[str, list[dict[str, Any]]] = {}
            for resource in BUNDLE_RESOURCE_ORDER:
                entry_name = f"{resource}.jsonl"
                if entry_name not in archive.namelist():
                    resources[resource] = []
                    continue
                raw_text = archive.read(entry_name).decode("utf-8")
                resources[resource] = [
                    json.loads(line) for line in raw_text.splitlines() if line.strip()
                ]
            return manifest, resources
    except BadZipFile as exc:
        raise ValueError(f"Unable to read bundle archive: {exc}.") from exc


def _is_placeholder_habit_action(row: dict[str, Any]) -> bool:
    return (
        row.get("status") == "pending"
        and row.get("notes") is None
        and row.get("deleted_at") is None
    )


def convert_bundle_payload(
    manifest: dict[str, Any],
    resources: dict[str, list[dict[str, Any]]],
) -> tuple[dict[str, Any], dict[str, list[dict[str, Any]]]]:
    """Convert a legacy v1 bundle payload into the current v2 payload."""
    converted_resources: dict[str, list[dict[str, Any]]] = {
        resource: list(resources.get(resource, [])) for resource in BUNDLE_RESOURCE_ORDER
    }
    legacy_habit_actions = converted_resources.get("habit-action", [])
    converted_habit_actions = [
        row for row in legacy_habit_actions if not _is_placeholder_habit_action(row)
    ]
    removed_placeholder_count = len(legacy_habit_actions) - len(converted_habit_actions)
    converted_resources["habit-action"] = converted_habit_actions

    resource_counts = {
        resource: len(converted_resources.get(resource, [])) for resource in BUNDLE_RESOURCE_ORDER
    }
    converted_manifest = {
        **manifest,
        "schema_version": BUNDLE_SCHEMA_VERSION,
        "converted_at": datetime.now().astimezone().isoformat(),
        "converted_from_schema_version": 1,
        "conversion_notes": [
            "Dropped legacy placeholder habit-action rows for sparse occurrence materialization."
        ],
        "removed_placeholder_habit_actions": removed_placeholder_count,
        "included_resources": list(BUNDLE_RESOURCE_ORDER),
        "resource_counts": resource_counts,
    }
    return converted_manifest, converted_resources


def _write_bundle(
    path: Path,
    *,
    manifest: dict[str, Any],
    resources: dict[str, list[dict[str, Any]]],
) -> None:
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        for resource in BUNDLE_RESOURCE_ORDER:
            rows = resources.get(resource, [])
            archive.writestr(
                f"{resource}.jsonl",
                "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
            )
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))


def convert_bundle_file(
    input_bundle: Path,
    output_bundle: Path,
    *,
    overwrite: bool = False,
) -> tuple[int, Path]:
    """Convert one legacy bundle file and return the removed placeholder count."""
    if not input_bundle.exists():
        raise ValueError(f"Input bundle {input_bundle} does not exist.")
    if output_bundle.exists() and not overwrite:
        raise ValueError(
            f"Output bundle {output_bundle} already exists. Use --overwrite to replace it."
        )
    manifest, resources = _read_legacy_bundle(input_bundle)
    converted_manifest, converted_resources = convert_bundle_payload(manifest, resources)
    _write_bundle(output_bundle, manifest=converted_manifest, resources=converted_resources)
    removed_count = int(converted_manifest["removed_placeholder_habit_actions"])
    return removed_count, output_bundle


def main(argv: Sequence[str] | None = None) -> int:
    """Run the legacy bundle conversion script."""
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        removed_count, output_path = convert_bundle_file(
            args.input_bundle,
            args.output_bundle,
            overwrite=args.overwrite,
        )
    except ValueError as exc:
        parser.error(str(exc))
    print(f"Converted bundle written to {output_path}")
    print(f"Removed placeholder habit-action rows: {removed_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
