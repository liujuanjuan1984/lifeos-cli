from __future__ import annotations

import asyncio
from pathlib import Path
from typing import cast
from uuid import UUID
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import data_ops


def test_batch_update_resource_parses_typed_timelog_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_update(session: object, **kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setitem(data_ops.UPDATE_OPERATIONS, "timelog", fake_update)

    report = asyncio.run(
        data_ops.batch_update_resource(
            cast(AsyncSession, object()),
            resource="timelog",
            rows=[
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "start_time": "2026-04-10T13:00:00+00:00",
                    "end_time": "2026-04-10T14:30:00+00:00",
                    "area_id": "22222222-2222-2222-2222-222222222222",
                    "task_id": "33333333-3333-3333-3333-333333333333",
                    "tag_ids": ["44444444-4444-4444-4444-444444444444"],
                    "person_ids": ["55555555-5555-5555-5555-555555555555"],
                }
            ],
        )
    )

    assert report.updated_count == 1
    assert captured["timelog_id"] == UUID("11111111-1111-1111-1111-111111111111")
    assert str(captured["start_time"]) == "2026-04-10 13:00:00+00:00"
    assert str(captured["end_time"]) == "2026-04-10 14:30:00+00:00"
    assert captured["area_id"] == UUID("22222222-2222-2222-2222-222222222222")
    assert captured["task_id"] == UUID("33333333-3333-3333-3333-333333333333")
    assert captured["tag_ids"] == [UUID("44444444-4444-4444-4444-444444444444")]
    assert captured["person_ids"] == [UUID("55555555-5555-5555-5555-555555555555")]


def test_batch_update_resource_parses_extended_note_relation_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_update(session: object, **kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setitem(data_ops.UPDATE_OPERATIONS, "note", fake_update)

    report = asyncio.run(
        data_ops.batch_update_resource(
            cast(AsyncSession, object()),
            resource="note",
            rows=[
                {
                    "id": "11111111-1111-1111-1111-111111111111",
                    "tag_ids": ["22222222-2222-2222-2222-222222222222"],
                    "task_ids": [
                        "33333333-3333-3333-3333-333333333333",
                        "44444444-4444-4444-4444-444444444444",
                    ],
                    "vision_ids": ["55555555-5555-5555-5555-555555555555"],
                    "event_ids": ["66666666-6666-6666-6666-666666666666"],
                    "timelog_ids": ["77777777-7777-7777-7777-777777777777"],
                }
            ],
        )
    )

    assert report.updated_count == 1
    assert captured["note_id"] == UUID("11111111-1111-1111-1111-111111111111")
    assert captured["tag_ids"] == [UUID("22222222-2222-2222-2222-222222222222")]
    assert captured["task_ids"] == [
        UUID("33333333-3333-3333-3333-333333333333"),
        UUID("44444444-4444-4444-4444-444444444444"),
    ]
    assert captured["vision_ids"] == [UUID("55555555-5555-5555-5555-555555555555")]
    assert captured["event_ids"] == [UUID("66666666-6666-6666-6666-666666666666")]
    assert captured["timelog_ids"] == [UUID("77777777-7777-7777-7777-777777777777")]


def test_batch_update_note_rejects_legacy_single_task_field() -> None:
    with pytest.raises(data_ops.DataOperationError, match="task_ids"):
        asyncio.run(
            data_ops.batch_update_resource(
                cast(AsyncSession, object()),
                resource="note",
                rows=[
                    {
                        "id": "11111111-1111-1111-1111-111111111111",
                        "task_id": "33333333-3333-3333-3333-333333333333",
                    }
                ],
            )
        )


def test_import_bundle_applies_base_rows_before_relations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    call_order: list[tuple[str, str]] = []

    async def fake_truncate(session: object) -> None:
        call_order.append(("truncate", "-"))

    async def fake_apply(
        session: object,
        *,
        prepared_row: data_ops.PreparedSnapshotRow,
    ) -> str:
        call_order.append(("base", prepared_row.resource))
        return "created"

    async def fake_sync(
        session: object,
        *,
        prepared_row: data_ops.PreparedSnapshotRow,
    ) -> None:
        call_order.append(("sync", prepared_row.resource))

    async def fake_hooks(session: object, *, resources: set[str]) -> None:
        call_order.append(("hooks", ",".join(sorted(resources))))

    monkeypatch.setattr(data_ops, "truncate_supported_data", fake_truncate)
    monkeypatch.setattr(data_ops, "_apply_snapshot_base_row", fake_apply)
    monkeypatch.setattr(data_ops, "_sync_snapshot_relations", fake_sync)
    monkeypatch.setattr(data_ops, "run_post_import_hooks", fake_hooks)

    report = asyncio.run(
        data_ops.import_bundle(
            cast(AsyncSession, object()),
            bundle_rows={
                "people": [{"id": "11111111-1111-1111-1111-111111111111"}],
                "tag": [{"id": "22222222-2222-2222-2222-222222222222"}],
            },
            replace_existing=True,
        )
    )

    base_positions = [index for index, call in enumerate(call_order) if call[0] == "base"]
    sync_positions = [index for index, call in enumerate(call_order) if call[0] == "sync"]

    assert report.created_count == 2
    assert report.updated_count == 0
    assert report.imported_resources == ("people", "tag")
    assert call_order[0] == ("truncate", "-")
    assert max(base_positions) < min(sync_positions)
    assert call_order[-1] == ("hooks", "people,tag")


def test_read_bundle_rejects_missing_manifest(tmp_path: Path) -> None:
    bundle_path = tmp_path / "broken-bundle.zip"
    with ZipFile(bundle_path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("note.jsonl", '{"id":"11111111-1111-1111-1111-111111111111"}\n')

    with pytest.raises(data_ops.DataOperationError, match="manifest.json"):
        data_ops.read_bundle(bundle_path)
