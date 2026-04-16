"""CLI handlers for the tag resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import (
    format_timestamp,
    print_batch_result,
    print_summary_rows,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import tags as tag_services
from lifeos_cli.db.services.read_models import TagView

TAG_SUMMARY_COLUMNS = ("tag_id", "status", "entity_type", "category", "name")


def _format_tag_summary(tag: TagView) -> str:
    status = "deleted" if tag.deleted_at is not None else "active"
    return f"{tag.id}\t{status}\t{tag.entity_type}\t{tag.category}\t{tag.name}"


def _format_tag_detail(tag: TagView) -> str:
    people_names = ", ".join(person.name for person in tag.people) if tag.people else "-"
    return "\n".join(
        (
            f"id: {tag.id}",
            f"name: {tag.name}",
            f"entity_type: {tag.entity_type}",
            f"category: {tag.category}",
            f"description: {tag.description or '-'}",
            f"color: {tag.color or '-'}",
            f"people: {people_names}",
            f"created_at: {format_timestamp(tag.created_at)}",
            f"updated_at: {format_timestamp(tag.updated_at)}",
            f"deleted_at: {format_timestamp(tag.deleted_at)}",
        )
    )


async def handle_tag_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            tag = await tag_services.create_tag(
                session,
                name=args.name,
                entity_type=args.entity_type,
                category=args.category,
                description=args.description,
                color=args.color,
                person_ids=args.person_ids,
            )
        except (
            tag_services.TagAlreadyExistsError,
            tag_services.InvalidTagEntityTypeError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created tag {tag.id}")
    return 0


handle_tag_add = make_sync_handler(handle_tag_add_async)


async def handle_tag_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            tags = await tag_services.list_tags(
                session,
                entity_type=args.entity_type,
                category=args.category,
                person_id=args.person_id,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except tag_services.InvalidTagEntityTypeError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print_summary_rows(
        items=tags,
        columns=TAG_SUMMARY_COLUMNS,
        row_formatter=_format_tag_summary,
        empty_message="No tags found.",
    )
    return 0


handle_tag_list = make_sync_handler(handle_tag_list_async)


async def handle_tag_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        tag = await tag_services.get_tag(
            session,
            tag_id=args.tag_id,
            include_deleted=args.include_deleted,
        )
    if tag is None:
        print(f"Tag {args.tag_id} was not found", file=sys.stderr)
        return 1
    print(_format_tag_detail(tag))
    return 0


handle_tag_show = make_sync_handler(handle_tag_show_async)


async def handle_tag_update_async(args: argparse.Namespace) -> int:
    if args.clear_description and args.description is not None:
        print("Use either --description or --clear-description, not both.", file=sys.stderr)
        return 1
    if args.clear_color and args.color is not None:
        print("Use either --color or --clear-color, not both.", file=sys.stderr)
        return 1
    if args.clear_people and args.person_ids is not None:
        print("Use either --person-id or --clear-people, not both.", file=sys.stderr)
        return 1
    async with db_session.session_scope() as session:
        try:
            tag = await tag_services.update_tag(
                session,
                tag_id=args.tag_id,
                name=args.name,
                entity_type=args.entity_type,
                category=args.category,
                description=args.description,
                clear_description=args.clear_description,
                color=args.color,
                clear_color=args.clear_color,
                person_ids=args.person_ids,
                clear_people=args.clear_people,
            )
        except (
            tag_services.TagNotFoundError,
            tag_services.TagAlreadyExistsError,
            tag_services.InvalidTagEntityTypeError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated tag {tag.id}")
    return 0


handle_tag_update = make_sync_handler(handle_tag_update_async)


async def handle_tag_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await tag_services.delete_tag(session, tag_id=args.tag_id)
        except tag_services.TagNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Soft-deleted tag {args.tag_id}")
    return 0


handle_tag_delete = make_sync_handler(handle_tag_delete_async)


async def handle_tag_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple tags in one command."""
    async with db_session.session_scope() as session:
        result = await tag_services.batch_delete_tags(
            session,
            tag_ids=list(args.tag_ids),
        )
    return print_batch_result(
        success_label="Deleted tags",
        success_count=result.deleted_count,
        failed_label="Failed tag IDs",
        result=result,
    )


handle_tag_batch_delete = make_sync_handler(handle_tag_batch_delete_async)
