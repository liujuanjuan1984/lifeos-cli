"""CLI handlers for the area resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import format_id_lines, format_timestamp
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.models.area import Area
from lifeos_cli.db.services import areas as area_services


def _format_area_summary(area: Area) -> str:
    status_parts: list[str] = []
    if area.deleted_at is not None:
        status_parts.append("deleted")
    status_parts.append("active" if area.is_active else "inactive")
    return f"{area.id}\t{'/'.join(status_parts)}\t{area.display_order}\t{area.name}"


def _format_area_detail(area: Area) -> str:
    return "\n".join(
        (
            f"id: {area.id}",
            f"name: {area.name}",
            f"description: {area.description or '-'}",
            f"color: {area.color}",
            f"icon: {area.icon or '-'}",
            f"is_active: {area.is_active}",
            f"display_order: {area.display_order}",
            f"created_at: {format_timestamp(area.created_at)}",
            f"updated_at: {format_timestamp(area.updated_at)}",
            f"deleted_at: {format_timestamp(area.deleted_at)}",
        )
    )


async def handle_area_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            area = await area_services.create_area(
                session,
                name=args.name,
                description=args.description,
                color=args.color,
                icon=args.icon,
                is_active=not args.inactive,
                display_order=args.display_order,
            )
        except area_services.AreaAlreadyExistsError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created area {area.id}")
    return 0


def handle_area_add(args: argparse.Namespace) -> int:
    return run_async(handle_area_add_async(args))


async def handle_area_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        areas = await area_services.list_areas(
            session,
            include_deleted=args.include_deleted,
            include_inactive=args.include_inactive,
            limit=args.limit,
            offset=args.offset,
        )
    if not areas:
        print("No areas found.")
        return 0
    for area in areas:
        print(_format_area_summary(area))
    return 0


def handle_area_list(args: argparse.Namespace) -> int:
    return run_async(handle_area_list_async(args))


async def handle_area_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        area = await area_services.get_area(
            session,
            area_id=args.area_id,
            include_deleted=args.include_deleted,
        )
    if area is None:
        print(f"Area {args.area_id} was not found", file=sys.stderr)
        return 1
    print(_format_area_detail(area))
    return 0


def handle_area_show(args: argparse.Namespace) -> int:
    return run_async(handle_area_show_async(args))


async def handle_area_update_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            area = await area_services.update_area(
                session,
                area_id=args.area_id,
                name=args.name,
                description=args.description,
                color=args.color,
                icon=args.icon,
                is_active=args.active,
                display_order=args.display_order,
            )
        except (area_services.AreaNotFoundError, area_services.AreaAlreadyExistsError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated area {area.id}")
    return 0


def handle_area_update(args: argparse.Namespace) -> int:
    return run_async(handle_area_update_async(args))


async def handle_area_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await area_services.delete_area(session, area_id=args.area_id)
        except area_services.AreaNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Soft-deleted area {args.area_id}")
    return 0


def handle_area_delete(args: argparse.Namespace) -> int:
    return run_async(handle_area_delete_async(args))


async def handle_area_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple areas in one command."""
    async with db_session.session_scope() as session:
        result = await area_services.batch_delete_areas(
            session,
            area_ids=list(args.area_ids),
        )
    print(f"Deleted areas: {result.deleted_count}")
    if result.failed_ids:
        print(format_id_lines("Failed area IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_area_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple areas in one command."""
    return run_async(handle_area_batch_delete_async(args))
