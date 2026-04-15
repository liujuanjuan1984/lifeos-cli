"""Habit-action resource handlers."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import format_timestamp, print_summary_rows
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.cli_support.time_args import DateArgumentError, resolve_date_interval_arguments
from lifeos_cli.db import session as db_session
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.services import habit_actions as habit_action_services
from lifeos_cli.db.services.read_models import HabitActionView

HABIT_ACTION_SUMMARY_COLUMNS = (
    "habit_action_id",
    "status",
    "action_date",
    "habit_id",
    "habit_title",
)


def _format_habit_action_summary(action: HabitActionView) -> str:
    status = "deleted" if action.deleted_at is not None else action.status
    action_id = "-" if action.id is None else str(action.id)
    return f"{action_id}\t{status}\t{action.action_date}\t{action.habit_id}\t{action.habit_title}"


def _format_habit_action_detail(action: HabitAction) -> str:
    habit_title = action.habit.title if action.habit is not None else "-"
    return "\n".join(
        (
            f"id: {action.id}",
            f"habit_id: {action.habit_id}",
            f"habit_title: {habit_title}",
            f"action_date: {action.action_date}",
            f"status: {action.status}",
            f"notes: {action.notes or '-'}",
            f"created_at: {format_timestamp(action.created_at)}",
            f"updated_at: {format_timestamp(action.updated_at)}",
            f"deleted_at: {format_timestamp(action.deleted_at)}",
        )
    )


async def handle_habit_action_list_async(args: argparse.Namespace) -> int:
    try:
        start_date, end_date = resolve_date_interval_arguments(
            date_values=args.date_values,
        )
    except DateArgumentError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    async with db_session.session_scope() as session:
        try:
            actions = await habit_action_services.list_habit_actions(
                session,
                habit_id=args.habit_id,
                status=args.status,
                start_date=start_date,
                end_date=end_date,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
            total_count = (
                await habit_action_services.count_habit_actions(
                    session,
                    habit_id=args.habit_id,
                    status=args.status,
                    start_date=start_date,
                    end_date=end_date,
                    include_deleted=args.include_deleted,
                )
                if args.count
                else None
            )
        except (
            habit_action_services.HabitNotFoundError,
            habit_action_services.HabitValidationError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    trailer_lines = () if total_count is None else (f"Total habit actions: {total_count}",)
    print_summary_rows(
        items=actions,
        columns=HABIT_ACTION_SUMMARY_COLUMNS,
        row_formatter=_format_habit_action_summary,
        empty_message="No habit actions found.",
        trailer_lines=trailer_lines,
    )
    return 0


def handle_habit_action_list(args: argparse.Namespace) -> int:
    return run_async(handle_habit_action_list_async(args))


async def handle_habit_action_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        action = await habit_action_services.get_habit_action(
            session,
            action_id=args.action_id,
            include_deleted=args.include_deleted,
        )
    if action is None:
        print(f"Habit action {args.action_id} was not found", file=sys.stderr)
        return 1
    print(_format_habit_action_detail(action))
    return 0


def handle_habit_action_show(args: argparse.Namespace) -> int:
    return run_async(handle_habit_action_show_async(args))


async def handle_habit_action_update_async(args: argparse.Namespace) -> int:
    if args.clear_notes and args.notes is not None:
        print("Use either --notes or --clear-notes, not both.", file=sys.stderr)
        return 1
    async with db_session.session_scope() as session:
        try:
            action = await habit_action_services.update_habit_action(
                session,
                action_id=args.action_id,
                status=args.status,
                notes=args.notes,
                clear_notes=args.clear_notes,
            )
        except (
            habit_action_services.HabitActionNotFoundError,
            habit_action_services.HabitValidationError,
            habit_action_services.InvalidHabitOperationError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated habit action {action.id}")
    return 0


def handle_habit_action_update(args: argparse.Namespace) -> int:
    return run_async(handle_habit_action_update_async(args))


async def handle_habit_action_log_async(args: argparse.Namespace) -> int:
    if args.clear_notes and args.notes is not None:
        print("Use either --notes or --clear-notes, not both.", file=sys.stderr)
        return 1
    if args.status is None and args.notes is None and not args.clear_notes:
        print("At least one of --status, --notes, or --clear-notes is required.", file=sys.stderr)
        return 1
    async with db_session.session_scope() as session:
        try:
            action = await habit_action_services.update_habit_action_by_date(
                session,
                habit_id=args.habit_id,
                action_date=args.action_date,
                status=args.status,
                notes=args.notes,
                clear_notes=args.clear_notes,
            )
        except (
            habit_action_services.HabitActionNotFoundError,
            habit_action_services.HabitNotFoundError,
            habit_action_services.HabitValidationError,
            habit_action_services.InvalidHabitOperationError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated habit action {action.id}")
    return 0


def handle_habit_action_log(args: argparse.Namespace) -> int:
    return run_async(handle_habit_action_log_async(args))
