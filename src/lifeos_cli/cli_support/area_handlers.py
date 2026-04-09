"""CLI handlers for the area resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.shared import format_timestamp, run_async
from lifeos_cli.db.services import (
    AreaAlreadyExistsError,
    AreaNotFoundError,
    create_area,
    delete_area,
    get_area,
    list_areas,
    update_area,
)
from lifeos_cli.db.session import session_scope


def _format_area_summary(area: object) -> str:
    status_parts: list[str] = []
    if getattr(area, "deleted_at", None) is not None:
        status_parts.append("deleted")
    status_parts.append("active" if getattr(area, "is_active", True) else "inactive")
    return (
        f"{getattr(area, 'id')}\t{'/'.join(status_parts)}\t"
        f"{getattr(area, 'display_order')}\t{getattr(area, 'name')}"
    )


def _format_area_detail(area: object) -> str:
    return "\n".join(
        (
            f"id: {getattr(area, 'id')}",
            f"name: {getattr(area, 'name')}",
            f"description: {getattr(area, 'description') or '-'}",
            f"color: {getattr(area, 'color')}",
            f"icon: {getattr(area, 'icon') or '-'}",
            f"is_active: {getattr(area, 'is_active')}",
            f"display_order: {getattr(area, 'display_order')}",
            f"created_at: {format_timestamp(getattr(area, 'created_at', None))}",
            f"updated_at: {format_timestamp(getattr(area, 'updated_at', None))}",
            f"deleted_at: {format_timestamp(getattr(area, 'deleted_at', None))}",
        )
    )


async def handle_area_add_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            area = await create_area(
                session,
                name=args.name,
                description=args.description,
                color=args.color,
                icon=args.icon,
                is_active=not args.inactive,
                display_order=args.display_order,
            )
        except AreaAlreadyExistsError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created area {area.id}")
    return 0


def handle_area_add(args: argparse.Namespace) -> int:
    return run_async(handle_area_add_async(args))


async def handle_area_list_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        areas = await list_areas(
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
    async with session_scope() as session:
        area = await get_area(session, area_id=args.area_id, include_deleted=args.include_deleted)
    if area is None:
        print(f"Area {args.area_id} was not found", file=sys.stderr)
        return 1
    print(_format_area_detail(area))
    return 0


def handle_area_show(args: argparse.Namespace) -> int:
    return run_async(handle_area_show_async(args))


async def handle_area_update_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            area = await update_area(
                session,
                area_id=args.area_id,
                name=args.name,
                description=args.description,
                color=args.color,
                icon=args.icon,
                is_active=args.active,
                display_order=args.display_order,
            )
        except (AreaNotFoundError, AreaAlreadyExistsError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated area {area.id}")
    return 0


def handle_area_update(args: argparse.Namespace) -> int:
    return run_async(handle_area_update_async(args))


async def handle_area_delete_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            await delete_area(session, area_id=args.area_id, hard_delete=args.hard)
        except AreaNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"{'Deleted' if args.hard else 'Soft-deleted'} area {args.area_id}")
    return 0


def handle_area_delete(args: argparse.Namespace) -> int:
    return run_async(handle_area_delete_async(args))
