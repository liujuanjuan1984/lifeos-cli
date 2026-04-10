"""CLI handlers for the vision resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import format_id_lines, format_timestamp
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services import visions as vision_services


def _format_vision_summary(vision: Vision) -> str:
    status = "deleted" if vision.deleted_at is not None else vision.status
    return f"{vision.id}\t{status}\t{vision.area_id or '-'}\t{vision.name}"


def _format_vision_detail(vision: Vision) -> str:
    people_names = (
        ", ".join(person.name for person in vision.people)
        if getattr(vision, "people", None)
        else "-"
    )
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
            f"people: {people_names}",
            f"created_at: {format_timestamp(vision.created_at)}",
            f"updated_at: {format_timestamp(vision.updated_at)}",
            f"deleted_at: {format_timestamp(vision.deleted_at)}",
        )
    )


async def handle_vision_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            vision = await vision_services.create_vision(
                session,
                name=args.name,
                description=args.description,
                status=args.status,
                area_id=args.area_id,
                person_ids=args.person_ids,
                experience_rate_per_hour=args.experience_rate_per_hour,
            )
        except (
            vision_services.VisionAlreadyExistsError,
            vision_services.AreaReferenceNotFoundError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created vision {vision.id}")
    return 0


def handle_vision_add(args: argparse.Namespace) -> int:
    return run_async(handle_vision_add_async(args))


async def handle_vision_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            visions = await vision_services.list_visions(
                session,
                status=args.status,
                area_id=args.area_id,
                person_id=args.person_id,
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
    async with db_session.session_scope() as session:
        vision = await vision_services.get_vision(
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
    conflicting_flags = (
        (
            args.clear_description and args.description is not None,
            "--description",
            "--clear-description",
        ),
        (args.clear_area and args.area_id is not None, "--area-id", "--clear-area"),
        (
            args.clear_experience_rate and args.experience_rate_per_hour is not None,
            "--experience-rate-per-hour",
            "--clear-experience-rate",
        ),
        (args.clear_people and args.person_ids is not None, "--person-id", "--clear-people"),
    )
    for is_conflict, value_flag, clear_flag in conflicting_flags:
        if is_conflict:
            print(f"Use either {value_flag} or {clear_flag}, not both.", file=sys.stderr)
            return 1
    async with db_session.session_scope() as session:
        try:
            vision = await vision_services.update_vision(
                session,
                vision_id=args.vision_id,
                name=args.name,
                description=args.description,
                clear_description=args.clear_description,
                status=args.status,
                area_id=args.area_id,
                clear_area=args.clear_area,
                person_ids=args.person_ids,
                clear_people=args.clear_people,
                experience_rate_per_hour=args.experience_rate_per_hour,
                clear_experience_rate=args.clear_experience_rate,
            )
        except (
            vision_services.VisionNotFoundError,
            vision_services.VisionAlreadyExistsError,
            vision_services.AreaReferenceNotFoundError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated vision {vision.id}")
    return 0


def handle_vision_update(args: argparse.Namespace) -> int:
    return run_async(handle_vision_update_async(args))


async def handle_vision_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await vision_services.delete_vision(session, vision_id=args.vision_id)
        except vision_services.VisionNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Soft-deleted vision {args.vision_id}")
    return 0


def handle_vision_delete(args: argparse.Namespace) -> int:
    return run_async(handle_vision_delete_async(args))


async def handle_vision_add_experience_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            vision = await vision_services.add_experience_to_vision(
                session,
                vision_id=args.vision_id,
                experience_points=args.experience_points,
            )
        except (vision_services.VisionNotFoundError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated vision {vision.id}")
    return 0


def handle_vision_add_experience(args: argparse.Namespace) -> int:
    return run_async(handle_vision_add_experience_async(args))


async def handle_vision_sync_experience_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            vision = await vision_services.sync_vision_experience(
                session,
                vision_id=args.vision_id,
            )
        except vision_services.VisionNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Synced vision {vision.id}")
    return 0


def handle_vision_sync_experience(args: argparse.Namespace) -> int:
    return run_async(handle_vision_sync_experience_async(args))


async def handle_vision_harvest_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            vision = await vision_services.harvest_vision(
                session,
                vision_id=args.vision_id,
            )
        except (
            vision_services.VisionNotFoundError,
            vision_services.VisionNotReadyForHarvestError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Harvested vision {vision.id}")
    return 0


def handle_vision_harvest(args: argparse.Namespace) -> int:
    return run_async(handle_vision_harvest_async(args))


async def handle_vision_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple visions in one command."""
    async with db_session.session_scope() as session:
        result = await vision_services.batch_delete_visions(
            session,
            vision_ids=list(args.vision_ids),
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
