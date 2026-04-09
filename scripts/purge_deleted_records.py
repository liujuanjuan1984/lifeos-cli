#!/usr/bin/env python3
"""Permanently remove already soft-deleted records from the database."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import UUID

from lifeos_cli.db.services import areas, notes, people, tags, tasks, visions
from lifeos_cli.db.session import session_scope

CONFIRMATION_TEXT = "permanently-delete-soft-deleted-records"


@dataclass(frozen=True)
class ResourceOperations:
    """Lookup and deletion callbacks for one resource type."""

    load: Callable[[UUID], Awaitable[object | None]]
    hard_delete: Callable[[UUID], Awaitable[None]]


def build_parser() -> argparse.ArgumentParser:
    """Build the purge script CLI parser."""
    parser = argparse.ArgumentParser(
        prog="purge_deleted_records.py",
        description=(
            "Permanently remove already soft-deleted records.\n\n"
            "This is an internal maintenance script. It is intentionally separate from the "
            "public `lifeos` CLI and requires an explicit confirmation phrase."
        ),
    )
    parser.add_argument(
        "resource",
        choices=("note", "area", "tag", "people", "vision", "task"),
        help="Resource type to purge",
    )
    parser.add_argument(
        "--ids",
        dest="record_ids",
        type=UUID,
        nargs="+",
        required=True,
        help="One or more resource identifiers to purge",
    )
    parser.add_argument(
        "--confirm",
        required=True,
        help=f"Required confirmation text: {CONFIRMATION_TEXT}",
    )
    return parser


async def purge_deleted_records(resource: str, record_ids: list[UUID]) -> int:
    """Permanently remove already soft-deleted records for one resource."""
    async with session_scope() as session:
        operations = {
            "note": ResourceOperations(
                load=lambda record_id: notes.get_note(
                    session,
                    note_id=record_id,
                    include_deleted=True,
                ),
                hard_delete=lambda record_id: notes.delete_note(
                    session,
                    note_id=record_id,
                    hard_delete=True,
                ),
            ),
            "area": ResourceOperations(
                load=lambda record_id: areas.get_area(
                    session,
                    area_id=record_id,
                    include_deleted=True,
                ),
                hard_delete=lambda record_id: areas.delete_area(
                    session,
                    area_id=record_id,
                    hard_delete=True,
                ),
            ),
            "tag": ResourceOperations(
                load=lambda record_id: tags.get_tag(
                    session,
                    tag_id=record_id,
                    include_deleted=True,
                ),
                hard_delete=lambda record_id: tags.delete_tag(
                    session,
                    tag_id=record_id,
                    hard_delete=True,
                ),
            ),
            "people": ResourceOperations(
                load=lambda record_id: people.get_person(
                    session,
                    person_id=record_id,
                    include_deleted=True,
                ),
                hard_delete=lambda record_id: people.delete_person(
                    session,
                    person_id=record_id,
                    hard_delete=True,
                ),
            ),
            "vision": ResourceOperations(
                load=lambda record_id: visions.get_vision(
                    session,
                    vision_id=record_id,
                    include_deleted=True,
                ),
                hard_delete=lambda record_id: visions.delete_vision(
                    session,
                    vision_id=record_id,
                    hard_delete=True,
                ),
            ),
            "task": ResourceOperations(
                load=lambda record_id: tasks.get_task(
                    session,
                    task_id=record_id,
                    include_deleted=True,
                ),
                hard_delete=lambda record_id: tasks.delete_task(
                    session,
                    task_id=record_id,
                    hard_delete=True,
                ),
            ),
        }[resource]

        exit_code = 0
        for record_id in list(dict.fromkeys(record_ids)):
            record = await operations.load(record_id)
            if record is None:
                print(f"Missing {resource} {record_id}; nothing was purged.")
                exit_code = 1
                continue
            if getattr(record, "deleted_at", None) is None:
                print(f"Refusing to purge active {resource} {record_id}; soft-delete it first.")
                exit_code = 1
                continue
            await operations.hard_delete(record_id)
            print(f"Purged {resource} {record_id}")
        return exit_code


def main() -> int:
    """Run the purge script."""
    parser = build_parser()
    args = parser.parse_args()
    if args.confirm != CONFIRMATION_TEXT:
        parser.error(f"--confirm must exactly match: {CONFIRMATION_TEXT}")
    return int(asyncio.run(purge_deleted_records(args.resource, list(args.record_ids))))


if __name__ == "__main__":
    raise SystemExit(main())
