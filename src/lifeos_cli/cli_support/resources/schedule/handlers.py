"""CLI handlers for the schedule resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import format_timestamp
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import schedules as schedule_services


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


def _format_schedule_day(day: schedule_services.ScheduleDay) -> str:
    lines = [f"date: {day.local_date}", "tasks:"]
    if day.tasks:
        lines.extend(_format_schedule_task(item) for item in day.tasks)
    else:
        lines.append("  -")

    lines.append("habit_actions:")
    if day.habit_actions:
        lines.extend(_format_schedule_habit_action(item) for item in day.habit_actions)
    else:
        lines.append("  -")

    lines.append("events:")
    if day.events:
        lines.extend(_format_schedule_event(item) for item in day.events)
    else:
        lines.append("  -")
    return "\n".join(lines)


async def handle_schedule_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        day = await schedule_services.get_schedule_for_date(session, target_date=args.target_date)
    print(_format_schedule_day(day))
    return 0


def handle_schedule_show(args: argparse.Namespace) -> int:
    return run_async(handle_schedule_show_async(args))


async def handle_schedule_list_async(args: argparse.Namespace) -> int:
    if args.end_date < args.start_date:
        print("--end-date must be on or after --start-date.", file=sys.stderr)
        return 1
    async with db_session.session_scope() as session:
        days = await schedule_services.list_schedule_in_range(
            session,
            start_date=args.start_date,
            end_date=args.end_date,
        )
    print("\n\n".join(_format_schedule_day(day) for day in days))
    return 0


def handle_schedule_list(args: argparse.Namespace) -> int:
    return run_async(handle_schedule_list_async(args))
