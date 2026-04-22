from __future__ import annotations

import asyncio
from datetime import date
from typing import Any, cast
from uuid import UUID

from lifeos_cli.db.services import schedule_queries
from tests.support import make_record, utc_datetime


def test_load_schedule_tasks_builds_overlap_query() -> None:
    class _Result:
        def scalars(self) -> list[object]:
            return []

    class _Session:
        statement = None

        async def execute(self, statement: object) -> _Result:
            self.statement = statement
            return _Result()

    session = _Session()
    tasks = asyncio.run(
        schedule_queries._load_schedule_tasks(
            cast(Any, session),
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 11),
        )
    )

    assert tasks == []
    assert session.statement is not None


def test_list_schedule_in_range_groups_tasks_actions_and_events(monkeypatch) -> None:
    async def fake_load_tasks(session: object, *, start_date: date, end_date: date) -> list[object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        return [
            make_record(
                id=UUID("11111111-1111-1111-1111-111111111111"),
                content="Draft release checklist",
                status="todo",
                planning_cycle_type="week",
                planning_cycle_days=2,
                planning_cycle_start_date=date(2026, 4, 10),
            )
        ]

    async def fake_list_habit_actions_in_range(
        session: object, *, start_date: date, end_date: date, include_deleted: bool
    ) -> list[object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        assert include_deleted is False
        return [
            make_record(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                habit_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                action_date=date(2026, 4, 10),
                status="todo",
                notes=None,
                habit_title="Daily Review",
            )
        ]

    async def fake_load_events(
        session: object,
        *,
        start_date: date,
        end_date: date,
    ) -> list[object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        return [
            make_record(
                id=UUID("33333333-3333-3333-3333-333333333333"),
                title="Late call",
                status="planned",
                event_type="appointment",
                start_time=utc_datetime(2026, 4, 10, 23, 30),
                end_time=utc_datetime(2026, 4, 11, 1, 0),
                task_id=None,
            )
        ]

    def fake_get_utc_window_for_local_date(target_date: date):
        if target_date == date(2026, 4, 10):
            return utc_datetime(2026, 4, 10, 0, 0), utc_datetime(2026, 4, 11, 0, 0)
        return utc_datetime(2026, 4, 11, 0, 0), utc_datetime(2026, 4, 12, 0, 0)

    def fake_get_utc_window_for_local_date_range(
        start_date: date,
        end_date: date,
    ) -> tuple[object, object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        return (
            utc_datetime(2026, 4, 10, 0, 0),
            utc_datetime(2026, 4, 11, 23, 59, 59).replace(microsecond=999999),
        )

    monkeypatch.setattr(schedule_queries, "_load_schedule_tasks", fake_load_tasks)
    monkeypatch.setattr(
        schedule_queries,
        "list_habit_actions_in_range",
        fake_list_habit_actions_in_range,
    )
    monkeypatch.setattr(schedule_queries, "_load_schedule_events", fake_load_events)
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date",
        fake_get_utc_window_for_local_date,
    )
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date_range",
        fake_get_utc_window_for_local_date_range,
    )
    monkeypatch.setattr(schedule_queries, "get_operational_date", lambda: date(2026, 4, 10))

    days = asyncio.run(
        schedule_queries.list_schedule_in_range(
            cast(Any, object()),
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 11),
        )
    )

    assert len(days) == 2
    assert days[0].local_date == date(2026, 4, 10)
    assert [item.content for item in days[0].tasks] == ["Draft release checklist"]
    assert [item.habit_title for item in days[0].habit_actions] == ["Daily Review"]
    assert [item.title for item in days[0].appointments] == ["Late call"]
    assert days[0].timeblocks == ()
    assert days[0].deadlines == ()
    assert days[1].local_date == date(2026, 4, 11)
    assert [item.content for item in days[1].tasks] == ["Draft release checklist"]
    assert days[1].habit_actions == ()
    assert [item.title for item in days[1].appointments] == ["Late call"]


def test_list_schedule_in_range_shows_overdue_unfinished_items_by_default(
    monkeypatch,
) -> None:
    async def fake_load_tasks(session: object, *, start_date: date, end_date: date) -> list[object]:
        return [
            make_record(
                id=UUID("11111111-1111-1111-1111-111111111111"),
                content="Overdue todo",
                status="todo",
                planning_cycle_type="day",
                planning_cycle_days=1,
                planning_cycle_start_date=date(2026, 4, 10),
            ),
            make_record(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                content="Completed old task",
                status="done",
                planning_cycle_type="day",
                planning_cycle_days=1,
                planning_cycle_start_date=date(2026, 4, 10),
            ),
            make_record(
                id=UUID("33333333-3333-3333-3333-333333333333"),
                content="Today todo",
                status="todo",
                planning_cycle_type="day",
                planning_cycle_days=1,
                planning_cycle_start_date=date(2026, 4, 12),
            ),
        ]

    async def fake_list_habit_actions_in_range(
        session: object, *, start_date: date, end_date: date, include_deleted: bool
    ) -> list[object]:
        assert include_deleted is False
        return [
            make_record(
                id=UUID("44444444-4444-4444-4444-444444444444"),
                habit_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                action_date=date(2026, 4, 10),
                status="pending",
                notes=None,
                habit_title="Overdue Review",
            ),
            make_record(
                id=UUID("55555555-5555-5555-5555-555555555555"),
                habit_id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                action_date=date(2026, 4, 10),
                status="done",
                notes=None,
                habit_title="Completed Review",
            ),
            make_record(
                id=UUID("66666666-6666-6666-6666-666666666666"),
                habit_id=UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                action_date=date(2026, 4, 12),
                status="pending",
                notes=None,
                habit_title="Today Review",
            ),
        ]

    async def fake_load_events(
        session: object,
        *,
        start_date: date,
        end_date: date,
    ) -> list[object]:
        return []

    def fake_get_utc_window_for_local_date(target_date: date):
        return utc_datetime(2026, 4, 10, 0, 0), utc_datetime(2026, 4, 11, 0, 0)

    monkeypatch.setattr(schedule_queries, "_load_schedule_tasks", fake_load_tasks)
    monkeypatch.setattr(
        schedule_queries,
        "list_habit_actions_in_range",
        fake_list_habit_actions_in_range,
    )
    monkeypatch.setattr(schedule_queries, "_load_schedule_events", fake_load_events)
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date",
        fake_get_utc_window_for_local_date,
    )
    monkeypatch.setattr(schedule_queries, "get_operational_date", lambda: date(2026, 4, 12))

    days = asyncio.run(
        schedule_queries.list_schedule_in_range(
            cast(Any, object()),
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 12),
        )
    )

    assert [item.content for item in days[0].tasks] == ["Overdue todo", "Completed old task"]
    assert [item.habit_title for item in days[0].habit_actions] == [
        "Overdue Review",
        "Completed Review",
    ]
    assert [item.content for item in days[2].tasks] == ["Today todo"]
    assert [item.habit_title for item in days[2].habit_actions] == ["Today Review"]


def test_list_schedule_in_range_can_hide_overdue_unfinished_items(monkeypatch) -> None:
    async def fake_load_tasks(session: object, *, start_date: date, end_date: date) -> list[object]:
        return [
            make_record(
                id=UUID("11111111-1111-1111-1111-111111111111"),
                content="Overdue todo",
                status="todo",
                planning_cycle_type="day",
                planning_cycle_days=1,
                planning_cycle_start_date=date(2026, 4, 10),
            )
        ]

    async def fake_list_habit_actions_in_range(
        session: object, *, start_date: date, end_date: date, include_deleted: bool
    ) -> list[object]:
        return [
            make_record(
                id=UUID("44444444-4444-4444-4444-444444444444"),
                habit_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                action_date=date(2026, 4, 10),
                status="pending",
                notes=None,
                habit_title="Overdue Review",
            )
        ]

    async def fake_load_events(
        session: object,
        *,
        start_date: date,
        end_date: date,
    ) -> list[object]:
        return []

    def fake_get_utc_window_for_local_date(target_date: date):
        return utc_datetime(2026, 4, 10, 0, 0), utc_datetime(2026, 4, 11, 0, 0)

    monkeypatch.setattr(schedule_queries, "_load_schedule_tasks", fake_load_tasks)
    monkeypatch.setattr(
        schedule_queries,
        "list_habit_actions_in_range",
        fake_list_habit_actions_in_range,
    )
    monkeypatch.setattr(schedule_queries, "_load_schedule_events", fake_load_events)
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date",
        fake_get_utc_window_for_local_date,
    )
    monkeypatch.setattr(schedule_queries, "get_operational_date", lambda: date(2026, 4, 12))

    days = asyncio.run(
        schedule_queries.list_schedule_in_range(
            cast(Any, object()),
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 10),
            hide_overdue_unfinished=True,
        )
    )

    assert days[0].tasks == ()
    assert days[0].habit_actions == ()


def test_list_schedule_in_range_uses_expanded_recurring_event_occurrences(monkeypatch) -> None:
    async def fake_load_tasks(session: object, *, start_date: date, end_date: date) -> list[object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        return []

    async def fake_list_habit_actions_in_range(
        session: object, *, start_date: date, end_date: date, include_deleted: bool
    ) -> list[object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        assert include_deleted is False
        return []

    calls: list[tuple[object, object]] = []

    async def fake_list_event_occurrences(
        session: object,
        *,
        query: object,
        **_: object,
    ) -> list[object]:
        occurrence_query = cast(schedule_queries.EventOccurrenceQuery, query)
        calls.append((occurrence_query.window_start, occurrence_query.window_end))
        return [
            make_record(
                id=UUID("33333333-3333-3333-3333-333333333333"),
                title="Daily review",
                status="planned",
                event_type="timeblock",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
                end_time=utc_datetime(2026, 4, 10, 13, 30),
                task_id=None,
            ),
            make_record(
                id=UUID("33333333-3333-3333-3333-333333333333"),
                title="Daily review",
                status="planned",
                event_type="timeblock",
                start_time=utc_datetime(2026, 4, 11, 13, 0),
                end_time=utc_datetime(2026, 4, 11, 13, 30),
                task_id=None,
            ),
        ]

    def fake_get_utc_window_for_local_date(target_date: date):
        if target_date == date(2026, 4, 10):
            return utc_datetime(2026, 4, 10, 0, 0), utc_datetime(2026, 4, 11, 0, 0)
        return utc_datetime(2026, 4, 11, 0, 0), utc_datetime(2026, 4, 12, 0, 0)

    def fake_get_utc_window_for_local_date_range(
        start_date: date,
        end_date: date,
    ) -> tuple[object, object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        return (
            utc_datetime(2026, 4, 10, 0, 0),
            utc_datetime(2026, 4, 11, 23, 59, 59).replace(microsecond=999999),
        )

    monkeypatch.setattr(schedule_queries, "_load_schedule_tasks", fake_load_tasks)
    monkeypatch.setattr(
        schedule_queries,
        "list_habit_actions_in_range",
        fake_list_habit_actions_in_range,
    )
    monkeypatch.setattr(schedule_queries, "list_event_occurrences", fake_list_event_occurrences)
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date",
        fake_get_utc_window_for_local_date,
    )
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date_range",
        fake_get_utc_window_for_local_date_range,
    )

    days = asyncio.run(
        schedule_queries.list_schedule_in_range(
            cast(Any, object()),
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 11),
        )
    )

    assert calls == [
        (
            utc_datetime(2026, 4, 10, 0, 0),
            utc_datetime(2026, 4, 11, 23, 59, 59).replace(microsecond=999999),
        )
    ]
    assert [item.title for item in days[0].timeblocks] == ["Daily review"]
    assert [item.title for item in days[1].timeblocks] == ["Daily review"]


def test_list_schedule_in_range_groups_events_by_type(monkeypatch) -> None:
    async def fake_load_tasks(session: object, *, start_date: date, end_date: date) -> list[object]:
        return []

    async def fake_list_habit_actions_in_range(
        session: object, *, start_date: date, end_date: date, include_deleted: bool
    ) -> list[object]:
        assert include_deleted is False
        return []

    async def fake_load_events(
        session: object,
        *,
        start_date: date,
        end_date: date,
    ) -> list[object]:
        return [
            make_record(
                id=UUID("11111111-1111-1111-1111-111111111111"),
                title="Doctor appointment",
                status="planned",
                event_type="appointment",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
                end_time=utc_datetime(2026, 4, 10, 14, 0),
                task_id=None,
            ),
            make_record(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                title="Focus block",
                status="planned",
                event_type="timeblock",
                start_time=utc_datetime(2026, 4, 10, 15, 0),
                end_time=utc_datetime(2026, 4, 10, 16, 0),
                task_id=None,
            ),
            make_record(
                id=UUID("33333333-3333-3333-3333-333333333333"),
                title="Tax deadline",
                status="planned",
                event_type="deadline",
                start_time=utc_datetime(2026, 4, 10, 17, 0),
                end_time=None,
                task_id=None,
            ),
        ]

    def fake_get_utc_window_for_local_date(target_date: date):
        return utc_datetime(2026, 4, 10, 0, 0), utc_datetime(2026, 4, 11, 0, 0)

    monkeypatch.setattr(schedule_queries, "_load_schedule_tasks", fake_load_tasks)
    monkeypatch.setattr(
        schedule_queries,
        "list_habit_actions_in_range",
        fake_list_habit_actions_in_range,
    )
    monkeypatch.setattr(schedule_queries, "_load_schedule_events", fake_load_events)
    monkeypatch.setattr(
        schedule_queries,
        "get_utc_window_for_local_date",
        fake_get_utc_window_for_local_date,
    )

    days = asyncio.run(
        schedule_queries.list_schedule_in_range(
            cast(Any, object()),
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 10),
        )
    )

    assert [item.title for item in days[0].appointments] == ["Doctor appointment"]
    assert [item.title for item in days[0].timeblocks] == ["Focus block"]
    assert [item.title for item in days[0].deadlines] == ["Tax deadline"]


def test_list_schedule_in_range_rejects_inverted_date_range() -> None:
    try:
        asyncio.run(
            schedule_queries.list_schedule_in_range(
                cast(Any, object()),
                start_date=date(2026, 4, 11),
                end_date=date(2026, 4, 10),
            )
        )
    except ValueError as exc:
        assert str(exc) == "end_date must be on or after start_date"
    else:
        raise AssertionError("Expected ValueError for inverted schedule range")
