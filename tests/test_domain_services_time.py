from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.config import clear_config_cache
from lifeos_cli.db.services import events, task_effort, timelogs
from tests.support import utc_datetime


async def _identity_event_view(_: object, event: object) -> object:
    return event


async def _identity_timelog_view(_: object, timelog: object) -> object:
    return timelog


def _set_timezone(monkeypatch: pytest.MonkeyPatch, timezone_name: str = "America/Toronto") -> None:
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_TIMEZONE", timezone_name)


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

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)

    event = asyncio.run(
        events.create_event(
            cast(Any, session),
            payload=events.EventCreateInput(
                title="Doctor appointment",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
            ),
        )
    )

    assert event.title == "Doctor appointment"
    assert event.event_type == "appointment"
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

    async def fake_flush_and_recompute(_: object, **__: object) -> None:
        await session.flush()

    async def fake_sync_tags(_: object, **kwargs: object) -> None:
        assert kwargs["entity_id"] == UUID("11111111-1111-1111-1111-111111111111")

    def record_add(timelog: object) -> None:
        session.added_timelog = timelog
        fake_add(timelog)

    async def fake_flush() -> None:
        added_timelog = getattr(session, "added_timelog", None)
        if added_timelog is not None and getattr(added_timelog, "id", None) is None:
            added_timelog.id = UUID("11111111-1111-1111-1111-111111111111")

    session.add = record_add
    session.flush = AsyncMock(side_effect=fake_flush)
    monkeypatch.setattr(timelogs, "ensure_timelog_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(timelogs, "ensure_timelog_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(timelogs, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(
        timelogs,
        "_flush_and_recompute_timelog_dependents",
        fake_flush_and_recompute,
    )
    monkeypatch.setattr(timelogs, "_build_timelog_view", _identity_timelog_view)

    timelog = asyncio.run(
        timelogs.create_timelog(
            cast(Any, session),
            payload=timelogs.TimelogCreateInput(
                title="Deep work",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
                end_time=utc_datetime(2026, 4, 10, 14, 0),
                tag_ids=[UUID("22222222-2222-2222-2222-222222222222")],
            ),
        )
    )

    assert timelog.title == "Deep work"
    assert timelog.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert timelog.end_time == utc_datetime(2026, 4, 10, 14, 0)
    assert session.flush.await_count == 2
    session.commit.assert_not_called()


def test_create_event_normalizes_offset_datetimes_to_utc(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            payload=events.EventCreateInput(
                title="Offset event",
                start_time=datetime(2026, 4, 10, 9, 0, tzinfo=timezone(timedelta(hours=-4))),
                end_time=datetime(2026, 4, 10, 10, 0, tzinfo=timezone(timedelta(hours=-4))),
            ),
        )
    )

    assert created.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert created.end_time == utc_datetime(2026, 4, 10, 14, 0)


def test_create_event_interprets_naive_datetimes_using_preferred_timezone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_timezone(monkeypatch)
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            payload=events.EventCreateInput(
                title="Local event",
                start_time=datetime(2026, 4, 10, 9, 0),
                end_time=datetime(2026, 4, 10, 10, 0),
            ),
        )
    )

    assert created.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert created.end_time == utc_datetime(2026, 4, 10, 14, 0)
    clear_config_cache()


def test_create_timelog_interprets_naive_datetimes_using_preferred_timezone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_timezone(monkeypatch)
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_flush_and_recompute(_: object, **__: object) -> None:
        await session.flush()

    session.add = fake_add
    monkeypatch.setattr(timelogs, "ensure_timelog_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(timelogs, "ensure_timelog_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(
        timelogs,
        "_flush_and_recompute_timelog_dependents",
        fake_flush_and_recompute,
    )
    monkeypatch.setattr(timelogs, "_build_timelog_view", _identity_timelog_view)

    created = asyncio.run(
        timelogs.create_timelog(
            cast(Any, session),
            payload=timelogs.TimelogCreateInput(
                title="Local timelog",
                start_time=datetime(2026, 4, 10, 9, 0),
                end_time=datetime(2026, 4, 10, 10, 0),
            ),
        )
    )

    assert created.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert created.end_time == utc_datetime(2026, 4, 10, 14, 0)
    clear_config_cache()


def test_create_event_accepts_recurrence_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            payload=events.EventCreateInput(
                title="Daily review",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
                recurrence_frequency="daily",
                recurrence_interval=2,
                recurrence_count=5,
            ),
        )
    )

    assert created.recurrence_frequency == "daily"
    assert created.recurrence_interval == 2
    assert created.recurrence_count == 5


def test_create_event_accepts_monthly_recurrence(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            payload=events.EventCreateInput(
                title="Monthly review",
                start_time=utc_datetime(2026, 4, 30, 20, 0),
                recurrence_frequency="monthly",
            ),
        )
    )

    assert created.recurrence_frequency == "monthly"
    assert created.recurrence_interval == 1
    assert created.recurrence_count is None


def test_create_event_accepts_event_type(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)

    created = asyncio.run(
        events.create_event(
            cast(Any, session),
            payload=events.EventCreateInput(
                title="Focus block",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
                event_type="timeblock",
            ),
        )
    )

    assert created.event_type == "timeblock"


def test_create_timelog_interprets_naive_datetimes_using_utc_preference(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_timezone(monkeypatch, "UTC")
    session = SimpleNamespace(add=None, flush=AsyncMock(), refresh=AsyncMock())

    def fake_add(_: object) -> None:
        pass

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_flush_and_recompute(_: object, **__: object) -> None:
        await session.flush()

    session.add = fake_add
    monkeypatch.setattr(timelogs, "ensure_timelog_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(timelogs, "ensure_timelog_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(
        timelogs,
        "_flush_and_recompute_timelog_dependents",
        fake_flush_and_recompute,
    )
    monkeypatch.setattr(timelogs, "_build_timelog_view", _identity_timelog_view)

    created = asyncio.run(
        timelogs.create_timelog(
            cast(Any, session),
            payload=timelogs.TimelogCreateInput(
                title="Naive record",
                start_time=datetime(2026, 4, 10, 13, 0),
                end_time=datetime(2026, 4, 10, 14, 0),
            ),
        )
    )

    assert created.start_time == utc_datetime(2026, 4, 10, 13, 0)
    assert created.end_time == utc_datetime(2026, 4, 10, 14, 0)
    clear_config_cache()


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
        event_type="appointment",
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

    async def fake_sync_tags(_: object, **__: object) -> None:
        return None

    async def fake_sync_people(_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(events, "_get_event_model", fake_get_event)
    monkeypatch.setattr(events, "_build_event_view", _identity_event_view)
    monkeypatch.setattr(events, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(events, "sync_entity_people", fake_sync_people)

    updated_event = asyncio.run(
        events.update_event(
            cast(Any, session),
            event_id=UUID("abababab-abab-abab-abab-abababababab"),
            changes=events.EventUpdateInput(
                clear_description=True,
                clear_end_time=True,
                clear_area=True,
                clear_task=True,
                clear_tags=True,
                clear_people=True,
            ),
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

    monkeypatch.setattr(events, "_get_event_model", fake_get_event)
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


def test_delete_event_single_interprets_naive_instance_start_using_preferred_timezone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_timezone(monkeypatch)
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

    monkeypatch.setattr(events, "_get_event_model", fake_get_event)
    monkeypatch.setattr(events, "_get_override_event_for_instance", fake_get_override_event)
    monkeypatch.setattr(events, "_record_skip_exception", record_skip)

    asyncio.run(
        events.delete_event(
            cast(Any, session),
            event_id=UUID("abababab-abab-abab-abab-abababababab"),
            scope="single",
            instance_start=datetime(2026, 4, 11, 9, 0),
        )
    )

    record_skip.assert_awaited_once()
    session.flush.assert_awaited_once()
    clear_config_cache()


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
                            event_type="appointment",
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
            query=events.EventOccurrenceQuery(
                window_start=utc_datetime(2026, 4, 10, 0, 0),
                window_end=utc_datetime(2026, 4, 12, 23, 59),
            ),
        )
    )

    assert [item.start_time for item in occurrences] == [
        utc_datetime(2026, 4, 10, 13, 0),
        utc_datetime(2026, 4, 12, 13, 0),
    ]


def test_list_event_occurrences_expands_monthly_series() -> None:
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
                            id=UUID("acacacac-acac-acac-acac-acacacacacac"),
                            title="Monthly review",
                            status="planned",
                            event_type="appointment",
                            start_time=utc_datetime(2026, 4, 30, 20, 0),
                            end_time=utc_datetime(2026, 4, 30, 21, 0),
                            task_id=None,
                            deleted_at=None,
                            recurrence_frequency="monthly",
                            recurrence_interval=1,
                            recurrence_count=3,
                            recurrence_until=None,
                            recurrence_parent_event_id=None,
                        )
                    ]
                ),
                _Result([]),
                _Result([]),
            ]

        async def execute(self, statement: object) -> _Result:
            return self._results.pop(0)

    occurrences = asyncio.run(
        events.list_event_occurrences(
            cast(Any, _Session()),
            query=events.EventOccurrenceQuery(
                window_start=utc_datetime(2026, 4, 1, 0, 0),
                window_end=utc_datetime(2026, 6, 30, 23, 59),
            ),
        )
    )

    assert [item.start_time for item in occurrences] == [
        utc_datetime(2026, 4, 30, 20, 0),
        utc_datetime(2026, 5, 30, 20, 0),
        utc_datetime(2026, 6, 30, 20, 0),
    ]


def test_list_event_occurrences_applies_all_supported_filters() -> None:
    class _Result:
        def __init__(self, values: list[object]) -> None:
            self._values = values

        def scalars(self) -> list[object]:
            return self._values

    class _Session:
        def __init__(self) -> None:
            self.statements: list[object] = []
            self._results = [_Result([]), _Result([])]

        async def execute(self, statement: object) -> _Result:
            self.statements.append(statement)
            return self._results.pop(0)

    area_id = UUID("11111111-1111-1111-1111-111111111111")
    task_id = UUID("22222222-2222-2222-2222-222222222222")
    person_id = UUID("33333333-3333-3333-3333-333333333333")
    tag_id = UUID("44444444-4444-4444-4444-444444444444")
    session = _Session()

    occurrences = asyncio.run(
        events.list_event_occurrences(
            cast(Any, session),
            query=events.EventOccurrenceQuery(
                window_start=utc_datetime(2026, 4, 10, 0, 0),
                window_end=utc_datetime(2026, 4, 12, 23, 59),
                filters=events.EventQueryFilters(
                    title_contains="review",
                    status="planned",
                    event_type="deadline",
                    area_id=area_id,
                    task_id=task_id,
                    person_id=person_id,
                    tag_id=tag_id,
                ),
            ),
        )
    )

    assert occurrences == []
    assert len(session.statements) == 2
    master_sql = str(session.statements[0])
    override_sql = str(session.statements[1])

    for statement_sql in (master_sql, override_sql):
        assert "person_associations" in statement_sql
        assert "tag_associations" in statement_sql
        assert "events.area_id" in statement_sql
        assert "events.task_id" in statement_sql
        assert "events.status" in statement_sql
        assert "events.event_type" in statement_sql
        assert "title" in statement_sql


def test_list_events_with_one_sided_window_uses_overlap_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Result:
        def scalars(self) -> list[object]:
            return []

    class _Session:
        def __init__(self) -> None:
            self.statements: list[object] = []

        async def execute(self, statement: object) -> _Result:
            self.statements.append(statement)
            return _Result()

    list_occurrences = AsyncMock(return_value=[])

    monkeypatch.setattr(events, "list_event_occurrences", list_occurrences)

    session = _Session()
    listed = asyncio.run(
        events.list_events(
            cast(Any, session),
            query=events.EventListInput(
                filters=events.EventQueryFilters(
                    window_start=utc_datetime(2026, 4, 10, 12, 0),
                )
            ),
        )
    )

    assert listed == []
    list_occurrences.assert_not_awaited()
    assert len(session.statements) == 1
    statement_sql = str(session.statements[0])
    assert "end_time IS NULL OR" in statement_sql
    assert "end_time >=" in statement_sql


def test_normalize_event_filters_deduplicates_discrete_dates() -> None:
    filters = events._normalize_event_filters(
        events.EventQueryFilters(
            date_values=(date(2026, 4, 10), date(2026, 4, 10), date(2026, 4, 12))
        )
    )

    assert filters.date_values == (date(2026, 4, 10), date(2026, 4, 12))


def test_resolve_timelog_filters_deduplicates_discrete_dates() -> None:
    filters = timelogs._resolve_timelog_filters(
        timelogs.TimelogQueryFilters(
            date_values=(date(2026, 4, 10), date(2026, 4, 10), date(2026, 4, 12))
        )
    )

    assert filters.date_values == (date(2026, 4, 10), date(2026, 4, 12))


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

    async def fake_sync_tags(_: object, **__: object) -> None:
        return None

    async def fake_sync_people(_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(timelogs, "_get_timelog_model", fake_get_timelog)
    monkeypatch.setattr(timelogs, "_build_timelog_view", _identity_timelog_view)
    monkeypatch.setattr(timelogs, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(timelogs, "sync_entity_people", fake_sync_people)
    recompute_task_effort = AsyncMock()
    monkeypatch.setattr(
        timelogs,
        "recompute_task_effort_after_timelog_change",
        recompute_task_effort,
    )
    recompute_timelog_stats = AsyncMock()
    monkeypatch.setattr(
        timelogs,
        "recompute_timelog_stats_groupby_area_after_change",
        recompute_timelog_stats,
    )

    updated_timelog = asyncio.run(
        timelogs.update_timelog(
            cast(Any, session),
            timelog_id=UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd"),
            changes=timelogs.TimelogUpdateInput(
                clear_location=True,
                clear_energy_level=True,
                clear_notes=True,
                clear_area=True,
                clear_task=True,
                clear_tags=True,
                clear_people=True,
            ),
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
    recompute_timelog_stats.assert_awaited_once()
    assert session.flush.await_count == 2
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
            changes=timelogs.TimelogBatchUpdateInput(
                find_title_text="Deep",
                replace_title_text="Focused",
                changes=timelogs.TimelogUpdateInput(
                    task_id=task_id,
                    clear_people=True,
                ),
            ),
        )
    )

    assert result.updated_count == 1
    assert result.failed_ids == (missing_id,)
    assert update_calls == [
        {
            "timelog_id": timelog_id,
            "changes": timelogs.TimelogUpdateInput(
                title="Focused work",
                area_id=None,
                clear_area=False,
                task_id=task_id,
                clear_task=False,
                tag_ids=None,
                clear_tags=False,
                person_ids=None,
                clear_people=True,
            ),
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
            changes=timelogs.TimelogBatchUpdateInput(
                find_title_text="Planning",
                replace_title_text="Review",
            ),
        )
    )

    assert result.updated_count == 0
    assert result.unchanged_ids == (timelog_id,)
    update_timelog.assert_not_awaited()
