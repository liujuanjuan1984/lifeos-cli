"""CLI handlers for the people resource."""

from __future__ import annotations

import argparse
import sys
from datetime import date

from lifeos_cli.cli_support.shared import format_timestamp, run_async
from lifeos_cli.db.services import (
    PersonAlreadyExistsError,
    PersonNotFoundError,
    create_person,
    delete_person,
    get_person,
    list_people,
    update_person,
)
from lifeos_cli.db.session import session_scope


def _parse_birth_date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def _format_person_summary(person: object) -> str:
    status = "deleted" if getattr(person, "deleted_at", None) is not None else "active"
    tag_names = ",".join(tag.name for tag in getattr(person, "tags", [])) or "-"
    return (
        f"{getattr(person, 'id')}\t{status}\t{getattr(person, 'name')}\t"
        f"{getattr(person, 'location') or '-'}\t{tag_names}"
    )


def _format_person_detail(person: object) -> str:
    tags = getattr(person, "tags", [])
    tag_names = ", ".join(tag.name for tag in tags) if tags else "-"
    nicknames = getattr(person, "nicknames", None) or []
    return "\n".join(
        (
            f"id: {getattr(person, 'id')}",
            f"name: {getattr(person, 'name')}",
            f"description: {getattr(person, 'description') or '-'}",
            f"nicknames: {', '.join(nicknames) if nicknames else '-'}",
            f"birth_date: {getattr(person, 'birth_date') or '-'}",
            f"location: {getattr(person, 'location') or '-'}",
            f"tags: {tag_names}",
            f"created_at: {format_timestamp(getattr(person, 'created_at', None))}",
            f"updated_at: {format_timestamp(getattr(person, 'updated_at', None))}",
            f"deleted_at: {format_timestamp(getattr(person, 'deleted_at', None))}",
        )
    )


async def handle_people_add_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            person = await create_person(
                session,
                name=args.name,
                description=args.description,
                nicknames=args.nickname,
                birth_date=_parse_birth_date(args.birth_date),
                location=args.location,
                tag_ids=args.tag_id,
            )
        except (PersonAlreadyExistsError, LookupError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created person {person.id}")
    return 0


def handle_people_add(args: argparse.Namespace) -> int:
    return run_async(handle_people_add_async(args))


async def handle_people_list_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        people = await list_people(
            session,
            search=args.search,
            tag_id=args.tag_id,
            include_deleted=args.include_deleted,
            limit=args.limit,
            offset=args.offset,
        )
    if not people:
        print("No people found.")
        return 0
    for person in people:
        print(_format_person_summary(person))
    return 0


def handle_people_list(args: argparse.Namespace) -> int:
    return run_async(handle_people_list_async(args))


async def handle_people_show_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        person = await get_person(
            session,
            person_id=args.person_id,
            include_deleted=args.include_deleted,
        )
    if person is None:
        print(f"Person {args.person_id} was not found", file=sys.stderr)
        return 1
    print(_format_person_detail(person))
    return 0


def handle_people_show(args: argparse.Namespace) -> int:
    return run_async(handle_people_show_async(args))


async def handle_people_update_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            person = await update_person(
                session,
                person_id=args.person_id,
                name=args.name,
                description=args.description,
                nicknames=args.nickname,
                birth_date=_parse_birth_date(args.birth_date) if args.birth_date else None,
                location=args.location,
                tag_ids=args.tag_id,
            )
        except (PersonNotFoundError, PersonAlreadyExistsError, LookupError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated person {person.id}")
    return 0


def handle_people_update(args: argparse.Namespace) -> int:
    return run_async(handle_people_update_async(args))


async def handle_people_delete_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            await delete_person(session, person_id=args.person_id, hard_delete=args.hard)
        except PersonNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"{'Deleted' if args.hard else 'Soft-deleted'} person {args.person_id}")
    return 0


def handle_people_delete(args: argparse.Namespace) -> int:
    return run_async(handle_people_delete_async(args))
