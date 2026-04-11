from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.services import events, task_effort, timelogs
from tests.support import utc_datetime


def test_create_event_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_attach_event_links(_: object, event: object) -> object:
        return event

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_attach_event_links", fake_attach_event_links)

    event = asyncio.run(
        events.create_event(
            cast(Any, session),
            title="Doctor appointment",
            start_time=utc_datetime(2026, 4, 10, 13, 0),
        )
    )

    assert event.title == "Doctor appointment"
    assert event.start_time == utc_datetime(2026, 4, 10, 13, 0)
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_create_timelog_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_attach_timelog_links(_: object, timelog: object) -> object:
        return timelog

    session.add = fake_add
    monkeypatch.setattr(timelogs, "ensure_timelog_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(timelogs, "ensure_timelog_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(timelogs, "_attach_timelog_links", fake_attach_timelog_links)

    timelog = asyncio.run(
        timelogs.create_timelog(
            cast(Any, session),
            title="Deep work",
            start_time=utc_datetime(2026, 4, 10, 13, 0),
            end_time=utc_datetime(2026, 4, 10, 14, 0),
        )
    )

    assert timelog.title == "Deep work"
    assert timelog.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert timelog.end_time == utc_datetime(2026, 4, 10, 14, 0)
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_create_event_normalizes_offset_datetimes_to_utc(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_attach_event_links(_: object, event: object) -> object:
        return event

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_attach_event_links", fake_attach_event_links)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            title="Offset event",
            start_time=datetime(2026, 4, 10, 9, 0, tzinfo=timezone(timedelta(hours=-4))),
            end_time=datetime(2026, 4, 10, 10, 0, tzinfo=timezone(timedelta(hours=-4))),
        )
    )

    assert created.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert created.end_time == utc_datetime(2026, 4, 10, 14, 0)


def test_create_event_accepts_recurrence_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_attach_event_links(_: object, event: object) -> object:
        return event

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_attach_event_links", fake_attach_event_links)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            title="Daily review",
            start_time=utc_datetime(2026, 4, 10, 13, 0),
            recurrence_frequency="daily",
            recurrence_interval=2,
            recurrence_count=5,
        )
    )

    assert created.recurrence_frequency == "daily"
    assert created.recurrence_interval == 2
    assert created.recurrence_count == 5


def test_create_timelog_rejects_naive_datetimes() -> None:
    session = SimpleNamespace()

    with pytest.raises(timelogs.TimelogValidationError):
        asyncio.run(
            timelogs.create_timelog(
                cast(Any, session),
                title="Naive record",
                start_time=datetime(2026, 4, 10, 13, 0),
                end_time=datetime(2026, 4, 10, 14, 0),
            )
        )


def test_timelog_minutes_uses_whole_positive_minutes() -> None:
    timelog = SimpleNamespace(
        start_time=utc_datetime(2026, 4, 10, 13, 0),
        end_time=utc_datetime(2026, 4, 10, 13, 59, 59),
    )
    invalid_timelog = SimpleNamespace(
        start_time=utc_datetime(2026, 4, 10, 13, 0),
        end_time=utc_datetime(2026, 4, 10, 12, 59),
    )

    assert task_effort._timelog_minutes(cast(Any, timelog)) == 59
    assert task_effort._timelog_minutes(cast(Any, invalid_timelog)) == 0


def test_update_event_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    event = SimpleNamespace(
        id=UUID("abababab-abab-abab-abab-abababababab"),
        title="Doctor appointment",
        description="Checkup",
        start_time=utc_datetime(2026, 4, 10, 9, 0),
        end_time=utc_datetime(2026, 4, 10, 10, 0),
        priority=3,
        status="planned",
        is_all_day=False,
        recurrence_frequency=None,
        recurrence_interval=None,
        recurrence_count=None,
        recurrence_until=None,
        area_id=UUID("11111111-1111-1111-1111-111111111111"),
        task_id=UUID("22222222-2222-2222-2222-222222222222"),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_event(_: object, *, event_id: UUID, include_deleted: bool = False) -> object:
        assert event_id == UUID("abababab-abab-abab-abab-abababababab")
        assert include_deleted is False
        return event

    async def fake_attach_event_links(_: object, event_record: object) -> object:
        return event_record

    async def fake_sync_tags(_: object, **__: object) -> None:
        return None

    async def fake_sync_people(_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(events, "get_event", fake_get_event)
    monkeypatch.setattr(events, "_attach_event_links", fake_attach_event_links)
    monkeypatch.setattr(events, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(events, "sync_entity_people", fake_sync_people)

    updated_event = asyncio.run(
        events.update_event(
            cast(Any, session),
            event_id=UUID("abababab-abab-abab-abab-abababababab"),
            clear_description=True,
            clear_end_time=True,
            clear_area=True,
            clear_task=True,
            clear_tags=True,
            clear_people=True,
        )
    )

    assert updated_event.description is None
    assert updated_event.end_time is None
    assert updated_event.area_id is None
    assert updated_event.task_id is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_delete_event_single_records_skip_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    event = SimpleNamespace(
        id=UUID("abababab-abab-abab-abab-abababababab"),
        start_time=utc_datetime(2026, 4, 10, 13, 0),
        end_time=utc_datetime(2026, 4, 10, 14, 0),
        recurrence_frequency="daily",
        recurrence_interval=1,
        recurrence_count=3,
        recurrence_until=None,
        recurrence_parent_event_id=None,
    )
    session = SimpleNamespace(flush=AsyncMock())
    record_skip = AsyncMock()

    async def fake_get_event(_: object, *, event_id: UUID, include_deleted: bool = False) -> object:
        assert event_id == UUID("abababab-abab-abab-abab-abababababab")
        assert include_deleted is False
        return event

    async def fake_get_override_event(
        _: object,
        *,
        master_event_id: UUID,
        instance_start: datetime,
    ) -> object | None:
        assert master_event_id == event.id
        assert instance_start == utc_datetime(2026, 4, 11, 13, 0)
        return None

    monkeypatch.setattr(events, "get_event", fake_get_event)
    monkeypatch.setattr(events, "_get_override_event_for_instance", fake_get_override_event)
    monkeypatch.setattr(events, "_record_skip_exception", record_skip)

    asyncio.run(
        events.delete_event(
            cast(Any, session),
            event_id=UUID("abababab-abab-abab-abab-abababababab"),
            scope="single",
            instance_start=utc_datetime(2026, 4, 11, 13, 0),
        )
    )

    record_skip.assert_awaited_once()
    session.flush.assert_awaited_once()


def test_list_event_occurrences_expands_recurring_series_and_skips_exceptions() -> None:
    class _Result:
        def __init__(self, values: list[object]) -> None:
            self._values = values

        def scalars(self) -> list[object]:
            return self._values

    class _Session:
        def __init__(self) -> None:
            self._results = [
                _Result(
                    [
                        SimpleNamespace(
                            id=UUID("abababab-abab-abab-abab-abababababab"),
                            title="Daily review",
                            status="planned",
                            start_time=utc_datetime(2026, 4, 10, 13, 0),
                            end_time=utc_datetime(2026, 4, 10, 14, 0),
                            task_id=None,
                            deleted_at=None,
                            recurrence_frequency="daily",
                            recurrence_interval=1,
                            recurrence_count=3,
                            recurrence_until=None,
                            recurrence_parent_event_id=None,
                        )
                    ]
                ),
                _Result(
                    [
                        SimpleNamespace(
                            master_event_id=UUID("abababab-abab-abab-abab-abababababab"),
                            instance_start=utc_datetime(2026, 4, 11, 13, 0),
                        )
                    ]
                ),
                _Result([]),
            ]

        async def execute(self, statement: object) -> _Result:
            return self._results.pop(0)

    occurrences = asyncio.run(
        events.list_event_occurrences(
            cast(Any, _Session()),
            window_start=utc_datetime(2026, 4, 10, 0, 0),
            window_end=utc_datetime(2026, 4, 12, 23, 59),
        )
    )

    assert [item.start_time for item in occurrences] == [
        utc_datetime(2026, 4, 10, 13, 0),
        utc_datetime(2026, 4, 12, 13, 0),
    ]


def test_update_timelog_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    timelog = SimpleNamespace(
        id=UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd"),
        title="Deep work",
        start_time=utc_datetime(2026, 4, 10, 13, 0),
        end_time=utc_datetime(2026, 4, 10, 14, 0),
        tracking_method="manual",
        location="Desk",
        energy_level=4,
        notes="Focused",
        area_id=UUID("11111111-1111-1111-1111-111111111111"),
        task_id=UUID("22222222-2222-2222-2222-222222222222"),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_timelog(
        _: object,
        *,
        timelog_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert timelog_id == UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
        assert include_deleted is False
        return timelog

    async def fake_attach_timelog_links(_: object, timelog_record: object) -> object:
        return timelog_record

    async def fake_sync_tags(_: object, **__: object) -> None:
        return None

    async def fake_sync_people(_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(timelogs, "get_timelog", fake_get_timelog)
    monkeypatch.setattr(timelogs, "_attach_timelog_links", fake_attach_timelog_links)
    monkeypatch.setattr(timelogs, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(timelogs, "sync_entity_people", fake_sync_people)
    recompute_task_effort = AsyncMock()
    monkeypatch.setattr(
        timelogs,
        "recompute_task_effort_after_timelog_change",
        recompute_task_effort,
    )

    updated_timelog = asyncio.run(
        timelogs.update_timelog(
            cast(Any, session),
            timelog_id=UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd"),
            clear_location=True,
            clear_energy_level=True,
            clear_notes=True,
            clear_area=True,
            clear_task=True,
            clear_tags=True,
            clear_people=True,
        )
    )

    assert updated_timelog.location is None
    assert updated_timelog.energy_level is None
    assert updated_timelog.notes is None
    assert updated_timelog.area_id is None
    assert updated_timelog.task_id is None
    recompute_task_effort.assert_awaited_once_with(
        cast(Any, session),
        old_task_id=UUID("22222222-2222-2222-2222-222222222222"),
        new_task_id=None,
    )
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_batch_update_timelogs_applies_title_replace_and_relation_updates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    timelog_id = UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
    missing_id = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    task_id = UUID("22222222-2222-2222-2222-222222222222")
    timelog = SimpleNamespace(id=timelog_id, title="Deep work")
    session = SimpleNamespace()
    update_calls: list[dict[str, object]] = []

    async def fake_get_timelog(
        _: object,
        *,
        timelog_id: UUID,
        include_deleted: bool = False,
    ) -> object | None:
        assert include_deleted is False
        if timelog_id == missing_id:
            return None
        return timelog

    async def fake_update_timelog(_: object, **kwargs: object) -> object:
        update_calls.append(kwargs)
        return timelog

    monkeypatch.setattr(timelogs, "get_timelog", fake_get_timelog)
    monkeypatch.setattr(timelogs, "update_timelog", fake_update_timelog)

    result = asyncio.run(
        timelogs.batch_update_timelogs(
            cast(Any, session),
            timelog_ids=[timelog_id, timelog_id, missing_id],
            find_title_text="Deep",
            replace_title_text="Focused",
            task_id=task_id,
            clear_people=True,
        )
    )

    assert result.updated_count == 1
    assert result.failed_ids == (missing_id,)
    assert update_calls == [
        {
            "timelog_id": timelog_id,
            "title": "Focused work",
            "area_id": None,
            "clear_area": False,
            "task_id": task_id,
            "clear_task": False,
            "tag_ids": None,
            "clear_tags": False,
            "person_ids": None,
            "clear_people": True,
        }
    ]


def test_batch_update_timelogs_reports_unchanged_title_replace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    timelog_id = UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
    session = SimpleNamespace()
    timelog = SimpleNamespace(id=timelog_id, title="Deep work")

    async def fake_get_timelog(
        _: object,
        *,
        timelog_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert include_deleted is False
        return timelog

    update_timelog = AsyncMock()
    monkeypatch.setattr(timelogs, "get_timelog", fake_get_timelog)
    monkeypatch.setattr(timelogs, "update_timelog", update_timelog)

    result = asyncio.run(
        timelogs.batch_update_timelogs(
            cast(Any, session),
            timelog_ids=[timelog_id],
            find_title_text="Planning",
            replace_title_text="Review",
        )
    )

    assert result.updated_count == 0
    assert result.unchanged_ids == (timelog_id,)
    update_timelog.assert_not_awaited()


def test_restore_timelog_clears_deleted_at_and_recomputes_effort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    timelog_id = UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
    task_id = UUID("22222222-2222-2222-2222-222222222222")
    timelog = SimpleNamespace(
        id=timelog_id,
        area_id=None,
        task_id=task_id,
        deleted_at=utc_datetime(2026, 4, 10, 15, 0),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock())

    async def fake_get_timelog(
        _: object,
        *,
        timelog_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert include_deleted is True
        return timelog

    async def fake_ensure_area_exists(_: object, area_id: UUID | None) -> None:
        assert area_id is None

    async def fake_ensure_task_exists(_: object, candidate_task_id: UUID | None) -> None:
        assert candidate_task_id == task_id

    async def fake_attach_timelog_links(_: object, timelog_record: object) -> object:
        return timelog_record

    monkeypatch.setattr(timelogs, "get_timelog", fake_get_timelog)
    monkeypatch.setattr(timelogs, "ensure_timelog_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(timelogs, "ensure_timelog_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(timelogs, "_attach_timelog_links", fake_attach_timelog_links)
    recompute_task_effort = AsyncMock()
    monkeypatch.setattr(
        timelogs,
        "recompute_task_effort_after_timelog_change",
        recompute_task_effort,
    )

    restored_timelog = asyncio.run(
        timelogs.restore_timelog(
            cast(Any, session),
            timelog_id=timelog_id,
        )
    )

    assert restored_timelog.deleted_at is None
    recompute_task_effort.assert_awaited_once_with(
        cast(Any, session),
        old_task_id=None,
        new_task_id=task_id,
    )
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(timelog)


def test_batch_restore_timelogs_reports_failed_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    target_id = UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
    missing_id = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    session = SimpleNamespace()

    async def fake_restore_timelog(_: object, *, timelog_id: UUID) -> object:
        if timelog_id == missing_id:
            raise timelogs.TimelogNotFoundError(f"Timelog {timelog_id} was not found")
        return SimpleNamespace(id=timelog_id)

    monkeypatch.setattr(timelogs, "restore_timelog", fake_restore_timelog)

    result = asyncio.run(
        timelogs.batch_restore_timelogs(
            cast(Any, session),
            timelog_ids=[target_id, target_id, missing_id],
        )
    )

    assert result.restored_count == 1
    assert result.failed_ids == (missing_id,)
