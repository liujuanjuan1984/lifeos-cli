from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pytest


def _load_converter_module():
    module_path = Path("scripts/convert_bundle_v1_to_v2.py")
    spec = importlib.util.spec_from_file_location("convert_bundle_v1_to_v2", module_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write_legacy_bundle(
    path: Path,
    *,
    habit_action_rows: list[dict[str, object]],
) -> None:
    manifest = {
        "schema_version": 1,
        "exported_at": "2026-04-12T12:00:00+00:00",
        "app_version": "0.1.0",
        "database_schema": "lifeos",
        "timezone": "America/Toronto",
        "included_resources": ["habit-action", "note"],
        "resource_counts": {"habit-action": len(habit_action_rows), "note": 1},
    }
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        archive.writestr(
            "habit-action.jsonl",
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in habit_action_rows),
        )
        archive.writestr(
            "note.jsonl",
            '{"id":"11111111-1111-1111-1111-111111111111","content":"keep-me"}\n',
        )


def test_convert_bundle_payload_drops_only_placeholder_habit_actions() -> None:
    converter = _load_converter_module()
    manifest = {"schema_version": 1, "resource_counts": {"habit-action": 4}}
    resources = {
        "habit-action": [
            {"id": "1", "status": "pending", "notes": None, "deleted_at": None},
            {"id": "2", "status": "done", "notes": None, "deleted_at": None},
            {"id": "3", "status": "pending", "notes": "keep", "deleted_at": None},
            {"id": "4", "status": "pending", "notes": None, "deleted_at": "2026-04-12T00:00:00Z"},
        ],
        "note": [{"id": "n1"}],
    }

    converted_manifest, converted_resources = converter.convert_bundle_payload(manifest, resources)

    assert converted_manifest["schema_version"] == 2
    assert converted_manifest["converted_from_schema_version"] == 1
    assert converted_manifest["removed_placeholder_habit_actions"] == 1
    assert [row["id"] for row in converted_resources["habit-action"]] == ["2", "3", "4"]
    assert converted_resources["note"] == [{"id": "n1"}]


def test_convert_bundle_file_writes_v2_bundle_and_preserves_other_resources(tmp_path: Path) -> None:
    converter = _load_converter_module()
    legacy_bundle = tmp_path / "legacy.zip"
    output_bundle = tmp_path / "converted.zip"
    _write_legacy_bundle(
        legacy_bundle,
        habit_action_rows=[
            {"id": "1", "status": "pending", "notes": None, "deleted_at": None},
            {"id": "2", "status": "done", "notes": None, "deleted_at": None},
        ],
    )

    removed_count, written_path = converter.convert_bundle_file(legacy_bundle, output_bundle)

    assert removed_count == 1
    assert written_path == output_bundle
    with ZipFile(output_bundle, "r") as archive:
        manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
        habit_action_rows = [
            json.loads(line)
            for line in archive.read("habit-action.jsonl").decode("utf-8").splitlines()
            if line.strip()
        ]
        note_rows = [
            json.loads(line)
            for line in archive.read("note.jsonl").decode("utf-8").splitlines()
            if line.strip()
        ]

    assert manifest["schema_version"] == 2
    assert manifest["removed_placeholder_habit_actions"] == 1
    assert manifest["resource_counts"]["habit-action"] == 1
    assert [row["id"] for row in habit_action_rows] == ["2"]
    assert note_rows == [{"id": "11111111-1111-1111-1111-111111111111", "content": "keep-me"}]


def test_convert_bundle_file_rejects_non_v1_input(tmp_path: Path) -> None:
    converter = _load_converter_module()
    invalid_bundle = tmp_path / "invalid.zip"
    with ZipFile(invalid_bundle, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", '{"schema_version": 2}\n')

    with pytest.raises(ValueError, match="Expected a legacy v1 bundle"):
        converter.convert_bundle_file(invalid_bundle, tmp_path / "out.zip")


def test_convert_bundle_main_supports_overwrite(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    converter = _load_converter_module()
    legacy_bundle = tmp_path / "legacy.zip"
    output_bundle = tmp_path / "converted.zip"
    _write_legacy_bundle(
        legacy_bundle,
        habit_action_rows=[{"id": "1", "status": "pending", "notes": None, "deleted_at": None}],
    )
    output_bundle.write_text("occupied", encoding="utf-8")

    exit_code = converter.main([str(legacy_bundle), str(output_bundle), "--overwrite"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert f"Converted bundle written to {output_bundle}" in captured.out
    assert "Removed placeholder habit-action rows: 1" in captured.out
