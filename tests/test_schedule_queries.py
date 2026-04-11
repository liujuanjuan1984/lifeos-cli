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

    async def fake_load_habit_actions(
        session: object, *, start_date: date, end_date: date
    ) -> list[object]:
        assert start_date == date(2026, 4, 10)
        assert end_date == date(2026, 4, 11)
        return [
            make_record(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                habit_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                action_date=date(2026, 4, 10),
                status="todo",
                notes=None,
                habit=make_record(title="Daily Review"),
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
                start_time=utc_datetime(2026, 4, 10, 23, 30),
                end_time=utc_datetime(2026, 4, 11, 1, 0),
                task_id=None,
            )
        ]

    def fake_get_utc_window_for_local_date(target_date: date):
        if target_date == date(2026, 4, 10):
            return utc_datetime(2026, 4, 10, 0, 0), utc_datetime(2026, 4, 11, 0, 0)
        return utc_datetime(2026, 4, 11, 0, 0), utc_datetime(2026, 4, 12, 0, 0)

    monkeypatch.setattr(schedule_queries, "_load_schedule_tasks", fake_load_tasks)
    monkeypatch.setattr(schedule_queries, "_load_schedule_habit_actions", fake_load_habit_actions)
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
            end_date=date(2026, 4, 11),
        )
    )

    assert len(days) == 2
    assert days[0].local_date == date(2026, 4, 10)
    assert [item.content for item in days[0].tasks] == ["Draft release checklist"]
    assert [item.habit_title for item in days[0].habit_actions] == ["Daily Review"]
    assert [item.title for item in days[0].events] == ["Late call"]
    assert days[1].local_date == date(2026, 4, 11)
    assert [item.content for item in days[1].tasks] == ["Draft release checklist"]
    assert days[1].habit_actions == ()
    assert [item.title for item in days[1].events] == ["Late call"]


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
