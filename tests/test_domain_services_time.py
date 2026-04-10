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

    def fake_add(event: object) -> None:
        session.added_event = event

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

    def fake_add(timelog: object) -> None:
        session.added_timelog = timelog

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

    def fake_add(event: object) -> None:
        session.added_event = event

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
