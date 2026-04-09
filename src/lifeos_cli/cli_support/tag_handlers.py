"""CLI handlers for the tag resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.shared import format_id_lines, format_timestamp, run_async
from lifeos_cli.db.models.tag import Tag
from lifeos_cli.db.services import (
    InvalidTagEntityTypeError,
    TagAlreadyExistsError,
    TagNotFoundError,
    batch_delete_tags,
    create_tag,
    delete_tag,
    get_tag,
    list_tags,
    update_tag,
)
from lifeos_cli.db.session import session_scope


def _format_tag_summary(tag: Tag) -> str:
    status = "deleted" if tag.deleted_at is not None else "active"
    return f"{tag.id}\t{status}\t{tag.entity_type}\t{tag.category}\t{tag.name}"


def _format_tag_detail(tag: Tag) -> str:
    return "\n".join(
        (
            f"id: {tag.id}",
            f"name: {tag.name}",
            f"entity_type: {tag.entity_type}",
            f"category: {tag.category}",
            f"description: {tag.description or '-'}",
            f"color: {tag.color or '-'}",
            f"created_at: {format_timestamp(tag.created_at)}",
            f"updated_at: {format_timestamp(tag.updated_at)}",
            f"deleted_at: {format_timestamp(tag.deleted_at)}",
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
        except (
            TagNotFoundError,
            TagAlreadyExistsError,
            InvalidTagEntityTypeError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated tag {tag.id}")
    return 0


def handle_tag_update(args: argparse.Namespace) -> int:
    return run_async(handle_tag_update_async(args))


async def handle_tag_delete_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            await delete_tag(session, tag_id=args.tag_id)
        except TagNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Soft-deleted tag {args.tag_id}")
    return 0


def handle_tag_delete(args: argparse.Namespace) -> int:
    return run_async(handle_tag_delete_async(args))


async def handle_tag_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple tags in one command."""
    async with session_scope() as session:
        result = await batch_delete_tags(
            session,
            tag_ids=list(args.tag_ids),
        )
    print(f"Deleted tags: {result.deleted_count}")
    if result.failed_ids:
        print(format_id_lines("Failed tag IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_tag_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple tags in one command."""
    return run_async(handle_tag_batch_delete_async(args))
