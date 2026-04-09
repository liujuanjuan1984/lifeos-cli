"""Habit-action resource handlers."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import format_timestamp
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.services import habit_actions as habit_action_services


def _format_habit_action_summary(action: HabitAction) -> str:
    status = "deleted" if action.deleted_at is not None else action.status
    habit_title = action.habit.title if action.habit is not None else "-"
    return f"{action.id}\t{status}\t{action.action_date}\t{action.habit_id}\t{habit_title}"


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
    async with db_session.session_scope() as session:
        try:
            actions = await habit_action_services.list_habit_actions(
                session,
                habit_id=args.habit_id,
                status=args.status,
                action_date=args.action_date,
                center_date=args.center_date,
                days_before=args.days_before,
                days_after=args.days_after,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except (
            habit_action_services.HabitNotFoundError,
            habit_action_services.HabitValidationError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    if not actions:
        print("No habit actions found.")
        return 0
    for action in actions:
        print(_format_habit_action_summary(action))
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
