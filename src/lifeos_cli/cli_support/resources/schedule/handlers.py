"""CLI handlers for the schedule resource."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support import handler_utils as cli_handler_utils
from lifeos_cli.cli_support.output_utils import format_summary_header, format_timestamp
from lifeos_cli.cli_support.time_args import (
    DateArgumentError,
    resolve_required_date_interval_arguments,
)
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import schedules as schedule_services

SCHEDULE_TASK_COLUMNS = (
    "task_id",
    "status",
    "planning_cycle_type",
    "planning_cycle_start_date",
    "planning_cycle_end_date",
    "content",
)
SCHEDULE_HABIT_ACTION_COLUMNS = ("habit_action_id", "status", "habit_id", "habit_title")
SCHEDULE_EVENT_COLUMNS = ("event_id", "status", "start_time", "end_time", "task_id", "title")


def _format_schedule_task(item: schedule_services.ScheduleTaskItem) -> str:
    return (
        f"  {item.id}\t{item.status}\t{item.planning_cycle_type}\t"
        f"{item.planning_cycle_start_date}\t{item.planning_cycle_end_date}\t{item.content}"
    )


def _format_schedule_habit_action(item: schedule_services.ScheduleHabitActionItem) -> str:
    return f"  {item.id}\t{item.status}\t{item.habit_id}\t{item.habit_title}"


def _format_schedule_event(item: schedule_services.ScheduleEventItem) -> str:
    return (
        f"  {item.id}\t{item.status}\t{format_timestamp(item.start_time)}\t"
        f"{format_timestamp(item.end_time)}\t{item.task_id or '-'}\t{item.title}"
    )


def _append_schedule_event_section(
    lines: list[str],
    *,
    heading: str,
    events: tuple[schedule_services.ScheduleEventItem, ...],
) -> None:
    lines.append(heading)
    if events:
        lines.append(f"  {format_summary_header(SCHEDULE_EVENT_COLUMNS)}")
        lines.extend(_format_schedule_event(item) for item in events)
    else:
        lines.append("  -")


def _format_schedule_day(day: schedule_services.ScheduleDay) -> str:
    lines = [f"date: {day.local_date}", "tasks:"]
    if day.tasks:
        lines.append(f"  {format_summary_header(SCHEDULE_TASK_COLUMNS)}")
        lines.extend(_format_schedule_task(item) for item in day.tasks)
    else:
        lines.append("  -")

    lines.append("habit_actions:")
    if day.habit_actions:
        lines.append(f"  {format_summary_header(SCHEDULE_HABIT_ACTION_COLUMNS)}")
        lines.extend(_format_schedule_habit_action(item) for item in day.habit_actions)
    else:
        lines.append("  -")

    _append_schedule_event_section(
        lines,
        heading="appointments:",
        events=day.appointments,
    )
    _append_schedule_event_section(
        lines,
        heading="timeblocks:",
        events=day.timeblocks,
    )
    _append_schedule_event_section(
        lines,
        heading="deadlines:",
        events=day.deadlines,
    )
    return "\n".join(lines)


async def handle_schedule_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        day = await schedule_services.get_schedule_for_date(session, target_date=args.target_date)
    print(_format_schedule_day(day))
    return 0


async def handle_schedule_list_async(args: argparse.Namespace) -> int:
    try:
        start_date, end_date = resolve_required_date_interval_arguments(
            date_values=args.date_values,
        )
    except DateArgumentError as exc:
        return cli_handler_utils.print_cli_error(exc)
    async with db_session.session_scope() as session:
        days = await schedule_services.list_schedule_in_range(
            session,
            start_date=start_date,
            end_date=end_date,
        )
    print("\n\n".join(_format_schedule_day(day) for day in days))
    return 0
