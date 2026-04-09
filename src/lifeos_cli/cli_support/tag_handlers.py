"""CLI handlers for the tag resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.shared import format_timestamp, run_async
from lifeos_cli.db.services import (
    InvalidTagEntityTypeError,
    TagAlreadyExistsError,
    TagNotFoundError,
    create_tag,
    delete_tag,
    get_tag,
    list_tags,
    update_tag,
)
from lifeos_cli.db.session import session_scope


def _format_tag_summary(tag: object) -> str:
    status = "deleted" if getattr(tag, "deleted_at", None) is not None else "active"
    return (
        f"{getattr(tag, 'id')}\t{status}\t{getattr(tag, 'entity_type')}\t"
        f"{getattr(tag, 'category')}\t{getattr(tag, 'name')}"
    )


def _format_tag_detail(tag: object) -> str:
    return "\n".join(
        (
            f"id: {getattr(tag, 'id')}",
            f"name: {getattr(tag, 'name')}",
            f"entity_type: {getattr(tag, 'entity_type')}",
            f"category: {getattr(tag, 'category')}",
            f"description: {getattr(tag, 'description') or '-'}",
            f"color: {getattr(tag, 'color') or '-'}",
            f"created_at: {format_timestamp(getattr(tag, 'created_at', None))}",
            f"updated_at: {format_timestamp(getattr(tag, 'updated_at', None))}",
            f"deleted_at: {format_timestamp(getattr(tag, 'deleted_at', None))}",
        )
    )


async def handle_tag_add_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            tag = await create_tag(
                session,
                name=args.name,
                entity_type=args.entity_type,
                category=args.category,
                description=args.description,
                color=args.color,
            )
        except (TagAlreadyExistsError, InvalidTagEntityTypeError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created tag {tag.id}")
    return 0


def handle_tag_add(args: argparse.Namespace) -> int:
    return run_async(handle_tag_add_async(args))


async def handle_tag_list_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            tags = await list_tags(
                session,
                entity_type=args.entity_type,
                category=args.category,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except InvalidTagEntityTypeError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    if not tags:
        print("No tags found.")
        return 0
    for tag in tags:
        print(_format_tag_summary(tag))
    return 0


def handle_tag_list(args: argparse.Namespace) -> int:
    return run_async(handle_tag_list_async(args))


async def handle_tag_show_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        tag = await get_tag(session, tag_id=args.tag_id, include_deleted=args.include_deleted)
    if tag is None:
        print(f"Tag {args.tag_id} was not found", file=sys.stderr)
        return 1
    print(_format_tag_detail(tag))
    return 0


def handle_tag_show(args: argparse.Namespace) -> int:
    return run_async(handle_tag_show_async(args))


async def handle_tag_update_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            tag = await update_tag(
                session,
                tag_id=args.tag_id,
                name=args.name,
                entity_type=args.entity_type,
                category=args.category,
                description=args.description,
                color=args.color,
            )
        except (TagNotFoundError, TagAlreadyExistsError, InvalidTagEntityTypeError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated tag {tag.id}")
    return 0


def handle_tag_update(args: argparse.Namespace) -> int:
    return run_async(handle_tag_update_async(args))


async def handle_tag_delete_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            await delete_tag(session, tag_id=args.tag_id, hard_delete=args.hard)
        except TagNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"{'Deleted' if args.hard else 'Soft-deleted'} tag {args.tag_id}")
    return 0


def handle_tag_delete(args: argparse.Namespace) -> int:
    return run_async(handle_tag_delete_async(args))
