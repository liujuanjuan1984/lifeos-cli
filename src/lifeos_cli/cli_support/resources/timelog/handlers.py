"""CLI handlers for the timelog resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support import handler_utils as cli_handler_utils
from lifeos_cli.cli_support.output_utils import (
    format_id_lines,
    format_timestamp,
    print_batch_result,
    print_summary_rows,
)
from lifeos_cli.cli_support.time_args import (
    DateArgumentError,
    resolve_date_interval_arguments,
    resolve_exclusive_date_or_datetime_query,
    resolve_required_date_interval_arguments,
)
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import timelog_stats
from lifeos_cli.db.services import timelogs as timelog_services
from lifeos_cli.db.services.read_models import TimelogView

TIMELOG_SUMMARY_COLUMNS = (
    "timelog_id",
    "status",
    "start_time",
    "end_time",
    "task_id",
    "linked_notes_count",
    "title",
)


def _format_timelog_summary(timelog: TimelogView) -> str:
    status = "deleted" if timelog.deleted_at is not None else timelog.tracking_method
    return (
        f"{timelog.id}\t{status}\t{format_timestamp(timelog.start_time)}\t"
        f"{format_timestamp(timelog.end_time)}\t{timelog.task_id or '-'}\t"
        f"{timelog.linked_notes_count}\t{timelog.title}"
    )


def _format_timelog_detail(timelog: TimelogView) -> str:
    tag_names = ", ".join(tag.name for tag in timelog.tags) if timelog.tags else "-"
    people_names = ", ".join(person.name for person in timelog.people) if timelog.people else "-"
    return "\n".join(
        (
            f"id: {timelog.id}",
            f"title: {timelog.title}",
            f"tracking_method: {timelog.tracking_method}",
            f"start_time: {format_timestamp(timelog.start_time)}",
            f"end_time: {format_timestamp(timelog.end_time)}",
            f"location: {timelog.location or '-'}",
            f"energy_level: {timelog.energy_level if timelog.energy_level is not None else '-'}",
            f"notes: {timelog.notes or '-'}",
            f"area_id: {timelog.area_id or '-'}",
            f"task_id: {timelog.task_id or '-'}",
            f"linked_notes_count: {timelog.linked_notes_count}",
            f"tags: {tag_names}",
            f"people: {people_names}",
            f"created_at: {format_timestamp(timelog.created_at)}",
            f"updated_at: {format_timestamp(timelog.updated_at)}",
            f"deleted_at: {format_timestamp(timelog.deleted_at)}",
        )
    )


def _format_timelog_stats_report(report: timelog_stats.TimelogStatsReport) -> str:
    lines = [
        f"granularity: {report.granularity}",
        f"start_date: {report.start_date.isoformat()}",
        f"end_date: {report.end_date.isoformat()}",
        f"timezone: {report.timezone}",
    ]
    if not report.rows:
        lines.append("No timelog stats found.")
        return "\n".join(lines)
    lines.extend(
        (
            "area_stats:",
            "area_id\tarea_name\tminutes\ttimelog_count",
        )
    )
    lines.extend(
        f"{row.area_id}\t{row.area_name or '-'}\t{row.minutes}\t{row.timelog_count}"
        for row in report.rows
    )
    return "\n".join(lines)


async def handle_timelog_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            timelog = await timelog_services.create_timelog(
                session,
                title=args.title,
                start_time=args.start_time,
                end_time=args.end_time,
                tracking_method=args.tracking_method,
                location=args.location,
                energy_level=args.energy_level,
                notes=args.notes,
                area_id=args.area_id,
                task_id=args.task_id,
                tag_ids=args.tag_ids,
                person_ids=args.person_ids,
            )
        except (
            timelog_services.TimelogAreaReferenceNotFoundError,
            timelog_services.TimelogTaskReferenceNotFoundError,
            timelog_services.TimelogValidationError,
            LookupError,
        ) as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Created timelog {timelog.id}")
    return 0


async def handle_timelog_list_async(args: argparse.Namespace) -> int:
    try:
        query = resolve_exclusive_date_or_datetime_query(
            date_values=args.date_values,
            window_start=args.window_start,
            window_end=args.window_end,
        )
    except DateArgumentError as exc:
        return cli_handler_utils.print_cli_error(exc)
    conflict_error = cli_handler_utils.validate_mutually_exclusive_pairs(
        (
            (
                args.without_area and (args.area_id is not None or args.area_name is not None),
                "an area filter",
                "--without-area",
            ),
            (args.without_task and args.task_id is not None, "--task-id", "--without-task"),
        )
    )
    if conflict_error is not None:
        return conflict_error
    async with db_session.session_scope() as session:
        try:
            timelogs = await timelog_services.list_timelogs(
                session,
                title_contains=args.title_contains,
                notes_contains=args.notes_contains,
                query=args.query,
                tracking_method=args.tracking_method,
                area_id=args.area_id,
                area_name=args.area_name,
                without_area=args.without_area,
                task_id=args.task_id,
                without_task=args.without_task,
                person_id=args.person_id,
                tag_id=args.tag_id,
                start_date=query.start_date,
                end_date=query.end_date,
                window_start=query.window_start,
                window_end=query.window_end,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
            total_count = (
                await timelog_services.count_timelogs(
                    session,
                    title_contains=args.title_contains,
                    notes_contains=args.notes_contains,
                    query=args.query,
                    tracking_method=args.tracking_method,
                    area_id=args.area_id,
                    area_name=args.area_name,
                    without_area=args.without_area,
                    task_id=args.task_id,
                    without_task=args.without_task,
                    person_id=args.person_id,
                    tag_id=args.tag_id,
                    start_date=query.start_date,
                    end_date=query.end_date,
                    window_start=query.window_start,
                    window_end=query.window_end,
                    include_deleted=args.include_deleted,
                )
                if args.count
                else None
            )
        except timelog_services.TimelogValidationError as exc:
            return cli_handler_utils.print_cli_error(exc)
    trailer_lines = () if total_count is None else (f"Total timelogs: {total_count}",)
    print_summary_rows(
        items=timelogs,
        columns=TIMELOG_SUMMARY_COLUMNS,
        row_formatter=_format_timelog_summary,
        empty_message="No timelogs found.",
        trailer_lines=trailer_lines,
    )
    return 0


async def handle_timelog_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        timelog = await timelog_services.get_timelog(
            session,
            timelog_id=args.timelog_id,
            include_deleted=args.include_deleted,
        )
    if timelog is None:
        return cli_handler_utils.print_missing_record_error("Timelog", args.timelog_id)
    print(_format_timelog_detail(timelog))
    return 0


async def handle_timelog_update_async(args: argparse.Namespace) -> int:
    conflicts = (
        (args.clear_location and args.location is not None, "--location", "--clear-location"),
        (
            args.clear_energy_level and args.energy_level is not None,
            "--energy-level",
            "--clear-energy-level",
        ),
        (args.clear_notes and args.notes is not None, "--notes", "--clear-notes"),
        (args.clear_area and args.area_id is not None, "--area-id", "--clear-area"),
        (args.clear_task and args.task_id is not None, "--task-id", "--clear-task"),
        (args.clear_tags and args.tag_ids is not None, "--tag-id", "--clear-tags"),
        (args.clear_people and args.person_ids is not None, "--person-id", "--clear-people"),
    )
    conflict_error = cli_handler_utils.validate_mutually_exclusive_pairs(conflicts)
    if conflict_error is not None:
        return conflict_error
    async with db_session.session_scope() as session:
        try:
            timelog = await timelog_services.update_timelog(
                session,
                timelog_id=args.timelog_id,
                title=args.title,
                start_time=args.start_time,
                end_time=args.end_time,
                tracking_method=args.tracking_method,
                location=args.location,
                clear_location=args.clear_location,
                energy_level=args.energy_level,
                clear_energy_level=args.clear_energy_level,
                notes=args.notes,
                clear_notes=args.clear_notes,
                area_id=args.area_id,
                clear_area=args.clear_area,
                task_id=args.task_id,
                clear_task=args.clear_task,
                tag_ids=args.tag_ids,
                clear_tags=args.clear_tags,
                person_ids=args.person_ids,
                clear_people=args.clear_people,
            )
        except (
            timelog_services.TimelogNotFoundError,
            timelog_services.TimelogAreaReferenceNotFoundError,
            timelog_services.TimelogTaskReferenceNotFoundError,
            timelog_services.TimelogValidationError,
            LookupError,
        ) as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Updated timelog {timelog.id}")
    return 0


async def handle_timelog_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await timelog_services.delete_timelog(session, timelog_id=args.timelog_id)
        except timelog_services.TimelogNotFoundError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Soft-deleted timelog {args.timelog_id}")
    return 0


def _timelog_batch_update_requested(args: argparse.Namespace) -> bool:
    return any(
        (
            args.title is not None,
            args.find_title_text is not None,
            args.area_id is not None,
            args.clear_area,
            args.task_id is not None,
            args.clear_task,
            args.tag_ids is not None,
            args.clear_tags,
            args.person_ids is not None,
            args.clear_people,
        )
    )


async def handle_timelog_batch_update_async(args: argparse.Namespace) -> int:
    conflicts = (
        (
            args.title is not None
            and (args.find_title_text is not None or args.replace_title_text is not None),
            "--title",
            "--find-title-text/--replace-title-text",
        ),
        (args.clear_area and args.area_id is not None, "--area-id", "--clear-area"),
        (args.clear_task and args.task_id is not None, "--task-id", "--clear-task"),
        (args.clear_tags and args.tag_ids is not None, "--tag-id", "--clear-tags"),
        (args.clear_people and args.person_ids is not None, "--person-id", "--clear-people"),
    )
    conflict_error = cli_handler_utils.validate_mutually_exclusive_pairs(conflicts)
    if conflict_error is not None:
        return conflict_error
    if args.replace_title_text is not None and args.find_title_text is None:
        print("Use --replace-title-text only with --find-title-text.", file=sys.stderr)
        return 1
    if not _timelog_batch_update_requested(args):
        print("At least one batch update option is required.", file=sys.stderr)
        return 1

    async with db_session.session_scope() as session:
        try:
            result = await timelog_services.batch_update_timelogs(
                session,
                timelog_ids=list(args.timelog_ids),
                title=args.title,
                find_title_text=args.find_title_text,
                replace_title_text=args.replace_title_text or "",
                area_id=args.area_id,
                clear_area=args.clear_area,
                task_id=args.task_id,
                clear_task=args.clear_task,
                tag_ids=args.tag_ids,
                clear_tags=args.clear_tags,
                person_ids=args.person_ids,
                clear_people=args.clear_people,
            )
        except timelog_services.TimelogValidationError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Updated timelogs: {result.updated_count}")
    if result.unchanged_ids:
        print(format_id_lines("Unchanged timelog IDs", result.unchanged_ids))
    if result.failed_ids:
        print(format_id_lines("Failed timelog IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


async def handle_timelog_batch_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        result = await timelog_services.batch_delete_timelogs(
            session,
            timelog_ids=list(args.timelog_ids),
        )
    return print_batch_result(
        success_label="Deleted timelogs",
        success_count=result.deleted_count,
        failed_label="Failed timelog IDs",
        result=result,
    )


async def handle_timelog_stats_day_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        report = await timelog_stats.get_timelog_stats_groupby_area_for_day(
            session,
            target_date=args.target_date,
        )
    print(_format_timelog_stats_report(report))
    return 0


async def handle_timelog_stats_range_async(args: argparse.Namespace) -> int:
    try:
        start_date, end_date = resolve_required_date_interval_arguments(
            date_values=args.date_values,
        )
    except DateArgumentError as exc:
        return cli_handler_utils.print_cli_error(exc)
    async with db_session.session_scope() as session:
        report = await timelog_stats.get_timelog_stats_groupby_area_for_range(
            session,
            start_date=start_date,
            end_date=end_date,
        )
    print(_format_timelog_stats_report(report))
    return 0


async def handle_timelog_stats_period_async(
    args: argparse.Namespace,
    *,
    granularity: str,
) -> int:
    target_date = args.target_date if granularity == "week" else None
    month = args.month if granularity == "month" else None
    year = args.year if granularity == "year" else None
    async with db_session.session_scope() as session:
        try:
            report = await timelog_stats.get_timelog_stats_groupby_area_for_period(
                session,
                granularity=granularity,
                target_date=target_date,
                month=month,
                year=year,
            )
        except timelog_stats.TimelogStatsValidationError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(_format_timelog_stats_report(report))
    return 0


async def handle_timelog_stats_rebuild_async(args: argparse.Namespace) -> int:
    try:
        start_date, end_date = resolve_date_interval_arguments(
            date_values=args.date_values,
        )
    except DateArgumentError as exc:
        return cli_handler_utils.print_cli_error(exc)
    if args.rebuild_all and any(value is not None for value in (start_date, end_date)):
        print("Use --all by itself, without --date.", file=sys.stderr)
        return 1
    async with db_session.session_scope() as session:
        try:
            rebuilt_dates = await timelog_stats.rebuild_timelog_stats_groupby_area(
                session,
                start_date=start_date,
                end_date=end_date,
                rebuild_all=args.rebuild_all,
            )
        except timelog_stats.TimelogStatsValidationError as exc:
            return cli_handler_utils.print_cli_error(exc)
    if not rebuilt_dates:
        print("No linked-area timelogs found for the selected rebuild scope.")
        return 0
    print(f"Rebuilt timelog stats grouped by area for {len(rebuilt_dates)} dates.")
    print(f"start_date: {rebuilt_dates[0].isoformat()}")
    print(f"end_date: {rebuilt_dates[-1].isoformat()}")
    return 0
