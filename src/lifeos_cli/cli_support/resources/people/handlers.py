"""CLI handlers for the people resource."""

from __future__ import annotations

import argparse
import sys
from datetime import date

from lifeos_cli.cli_support.output_utils import format_timestamp, print_batch_result
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import people as people_services
from lifeos_cli.db.services.read_models import PersonView


def _parse_birth_date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def _format_person_summary(person: PersonView) -> str:
    status = "deleted" if person.deleted_at is not None else "active"
    tag_names = ",".join(tag.name for tag in person.tags) or "-"
    return f"{person.id}\t{status}\t{person.name}\t{person.location or '-'}\t{tag_names}"


def _format_person_detail(person: PersonView) -> str:
    tag_names = ", ".join(tag.name for tag in person.tags) if person.tags else "-"
    nicknames = person.nicknames
    return "\n".join(
        (
            f"id: {person.id}",
            f"name: {person.name}",
            f"description: {person.description or '-'}",
            f"nicknames: {', '.join(nicknames) if nicknames else '-'}",
            f"birth_date: {person.birth_date or '-'}",
            f"location: {person.location or '-'}",
            f"tags: {tag_names}",
            f"created_at: {format_timestamp(person.created_at)}",
            f"updated_at: {format_timestamp(person.updated_at)}",
            f"deleted_at: {format_timestamp(person.deleted_at)}",
        )
    )


async def handle_people_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            person = await people_services.create_person(
                session,
                name=args.name,
                description=args.description,
                nicknames=args.nickname,
                birth_date=_parse_birth_date(args.birth_date),
                location=args.location,
                tag_ids=args.tag_id,
            )
        except (people_services.PersonAlreadyExistsError, LookupError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created person {person.id}")
    return 0


def handle_people_add(args: argparse.Namespace) -> int:
    return run_async(handle_people_add_async(args))


async def handle_people_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        people = await people_services.list_people(
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
    async with db_session.session_scope() as session:
        person = await people_services.get_person(
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
    conflicting_flags = (
        (
            args.clear_description and args.description is not None,
            "--description",
            "--clear-description",
        ),
        (args.clear_nicknames and args.nickname is not None, "--nickname", "--clear-nicknames"),
        (
            args.clear_birth_date and args.birth_date is not None,
            "--birth-date",
            "--clear-birth-date",
        ),
        (args.clear_location and args.location is not None, "--location", "--clear-location"),
        (args.clear_tags and args.tag_id is not None, "--tag-id", "--clear-tags"),
    )
    for is_conflict, value_flag, clear_flag in conflicting_flags:
        if is_conflict:
            print(f"Use either {value_flag} or {clear_flag}, not both.", file=sys.stderr)
            return 1
    async with db_session.session_scope() as session:
        try:
            person = await people_services.update_person(
                session,
                person_id=args.person_id,
                name=args.name,
                description=args.description,
                clear_description=args.clear_description,
                nicknames=args.nickname,
                clear_nicknames=args.clear_nicknames,
                birth_date=_parse_birth_date(args.birth_date) if args.birth_date else None,
                clear_birth_date=args.clear_birth_date,
                location=args.location,
                clear_location=args.clear_location,
                tag_ids=args.tag_id,
                clear_tags=args.clear_tags,
            )
        except (
            people_services.PersonNotFoundError,
            people_services.PersonAlreadyExistsError,
            LookupError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated person {person.id}")
    return 0


def handle_people_update(args: argparse.Namespace) -> int:
    return run_async(handle_people_update_async(args))


async def handle_people_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await people_services.delete_person(session, person_id=args.person_id)
        except people_services.PersonNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Soft-deleted person {args.person_id}")
    return 0


def handle_people_delete(args: argparse.Namespace) -> int:
    return run_async(handle_people_delete_async(args))


async def handle_people_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple people in one command."""
    async with db_session.session_scope() as session:
        result = await people_services.batch_delete_people(
            session,
            person_ids=list(args.person_ids),
        )
    return print_batch_result(
        success_label="Deleted people",
        success_count=result.deleted_count,
        failed_label="Failed person IDs",
        result=result,
    )


def handle_people_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple people in one command."""
    return run_async(handle_people_batch_delete_async(args))
