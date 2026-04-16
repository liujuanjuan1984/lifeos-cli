from __future__ import annotations

from datetime import date
from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import schedules
from tests.support import make_session_scope, utc_datetime


def test_main_schedule_show_prints_grouped_sections(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_get_schedule_for_date(session: object, *, target_date: date) -> object:
        assert str(target_date) == "2026-04-10"
        return schedules.ScheduleDay(
            local_date=target_date,
            tasks=(
                schedules.ScheduleTaskItem(
                    id=UUID("11111111-1111-1111-1111-111111111111"),
                    content="Draft release checklist",
                    status="todo",
                    planning_cycle_type="week",
                    planning_cycle_days=7,
                    planning_cycle_start_date=target_date,
                    planning_cycle_end_date=target_date,
                ),
            ),
            habit_actions=(
                schedules.ScheduleHabitActionItem(
                    id=UUID("22222222-2222-2222-2222-222222222222"),
                    habit_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    habit_title="Daily Review",
                    action_date=target_date,
                    status="todo",
                    notes=None,
                ),
            ),
            appointments=(
                schedules.ScheduleEventItem(
                    id=UUID("33333333-3333-3333-3333-333333333333"),
                    title="Doctor appointment",
                    status="planned",
                    event_type="appointment",
                    start_time=utc_datetime(2026, 4, 10, 13, 0),
                    end_time=utc_datetime(2026, 4, 10, 14, 0),
                    task_id=None,
                ),
            ),
            timeblocks=(),
            deadlines=(),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(schedules, "get_schedule_for_date", fake_get_schedule_for_date)

    exit_code = cli.main(["schedule", "show", "--date", "2026-04-10"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "date: 2026-04-10" in captured.out
    assert "tasks:" in captured.out
    assert (
        "  task_id\tstatus\tplanning_cycle_type\tplanning_cycle_start_date\t"
        "planning_cycle_end_date\tcontent" in captured.out
    )
    assert "habit_actions:" in captured.out
    assert "  habit_action_id\tstatus\thabit_id\thabit_title" in captured.out
    assert "appointments:" in captured.out
    assert "  event_id\tstatus\tstart_time\tend_time\ttask_id\ttitle" in captured.out
    assert "timeblocks:" in captured.out
    assert "deadlines:" in captured.out
    assert "Draft release checklist" in captured.out
    assert "Daily Review" in captured.out
    assert "Doctor appointment" in captured.out


def test_main_schedule_list_rejects_inverted_date_range(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "schedule",
            "list",
            "--date",
            "2026-04-11",
            "--date",
            "2026-04-10",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert (
        "When --date is repeated, the second date must be on or after the first date."
        in captured.err
    )
