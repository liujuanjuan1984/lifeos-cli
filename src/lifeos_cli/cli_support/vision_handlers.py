"""CLI handlers for the vision resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.shared import format_id_lines, format_timestamp, run_async
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services import (
    AreaReferenceNotFoundError,
    VisionAlreadyExistsError,
    VisionNotFoundError,
    batch_delete_visions,
    create_vision,
    delete_vision,
    get_vision,
    list_visions,
    update_vision,
)
from lifeos_cli.db.session import session_scope


def _format_vision_summary(vision: Vision) -> str:
    status = "deleted" if vision.deleted_at is not None else vision.status
    return f"{vision.id}\t{status}\t{vision.area_id or '-'}\t{vision.name}"


def _format_vision_detail(vision: Vision) -> str:
    return "\n".join(
        (
            f"id: {vision.id}",
            f"name: {vision.name}",
            f"description: {vision.description or '-'}",
            f"status: {vision.status}",
            f"stage: {vision.stage}",
            f"experience_points: {vision.experience_points}",
            f"experience_rate_per_hour: {vision.experience_rate_per_hour or '-'}",
            f"area_id: {vision.area_id or '-'}",
            f"created_at: {format_timestamp(vision.created_at)}",
            f"updated_at: {format_timestamp(vision.updated_at)}",
            f"deleted_at: {format_timestamp(vision.deleted_at)}",
        )
    )


async def handle_vision_add_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            vision = await create_vision(
                session,
                name=args.name,
                description=args.description,
                status=args.status,
                area_id=args.area_id,
                experience_rate_per_hour=args.experience_rate_per_hour,
            )
        except (VisionAlreadyExistsError, AreaReferenceNotFoundError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created vision {vision.id}")
    return 0


def handle_vision_add(args: argparse.Namespace) -> int:
    return run_async(handle_vision_add_async(args))


async def handle_vision_list_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            visions = await list_visions(
                session,
                status=args.status,
                area_id=args.area_id,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    if not visions:
        print("No visions found.")
        return 0
    for vision in visions:
        print(_format_vision_summary(vision))
    return 0


def handle_vision_list(args: argparse.Namespace) -> int:
    return run_async(handle_vision_list_async(args))


async def handle_vision_show_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        vision = await get_vision(
            session,
            vision_id=args.vision_id,
            include_deleted=args.include_deleted,
        )
    if vision is None:
        print(f"Vision {args.vision_id} was not found", file=sys.stderr)
        return 1
    print(_format_vision_detail(vision))
    return 0


def handle_vision_show(args: argparse.Namespace) -> int:
    return run_async(handle_vision_show_async(args))


async def handle_vision_update_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            vision = await update_vision(
                session,
                vision_id=args.vision_id,
                name=args.name,
                description=args.description,
                status=args.status,
                area_id=args.area_id,
                experience_rate_per_hour=args.experience_rate_per_hour,
            )
        except (
            VisionNotFoundError,
            VisionAlreadyExistsError,
            AreaReferenceNotFoundError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated vision {vision.id}")
    return 0


def handle_vision_update(args: argparse.Namespace) -> int:
    return run_async(handle_vision_update_async(args))


async def handle_vision_delete_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            await delete_vision(session, vision_id=args.vision_id, hard_delete=args.hard)
        except VisionNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"{'Deleted' if args.hard else 'Soft-deleted'} vision {args.vision_id}")
    return 0


def handle_vision_delete(args: argparse.Namespace) -> int:
    return run_async(handle_vision_delete_async(args))


async def handle_vision_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple visions in one command."""
    async with session_scope() as session:
        result = await batch_delete_visions(
            session,
            vision_ids=list(args.vision_ids),
            hard_delete=args.hard,
        )
    print(f"Deleted visions: {result.deleted_count}")
    if result.failed_ids:
        print(format_id_lines("Failed vision IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_vision_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple visions in one command."""
    return run_async(handle_vision_batch_delete_async(args))
