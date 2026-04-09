"""Async CRUD helpers for people."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Text, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.person import Person
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.services.entity_tags import load_tags_for_entities, sync_entity_tags


class PersonNotFoundError(LookupError):
    """Raised when a person cannot be found."""


class PersonAlreadyExistsError(ValueError):
    """Raised when a person with the same name already exists."""


async def _attach_tags(session: AsyncSession, person: Person) -> Person:
    tags_map = await load_tags_for_entities(
        session,
        entity_ids=[person.id],
        entity_type="person",
    )
    setattr(person, "tags", tags_map.get(person.id, []))
    return person


async def create_person(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    nicknames: list[str] | None = None,
    birth_date: date | None = None,
    location: str | None = None,
    tag_ids: list[UUID] | None = None,
) -> Person:
    """Create a new person."""
    normalized_name = name.strip()
    existing = await session.execute(
        select(Person).where(Person.name == normalized_name, Person.deleted_at.is_(None)).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise PersonAlreadyExistsError(f"Person with name {normalized_name!r} already exists")
    person = Person(
        name=normalized_name,
        description=description,
        nicknames=nicknames or None,
        birth_date=birth_date,
        location=location,
    )
    session.add(person)
    await session.flush()
    if tag_ids:
        await sync_entity_tags(
            session,
            entity_id=person.id,
            entity_type="person",
            desired_tag_ids=tag_ids,
        )
    await session.refresh(person)
    return await _attach_tags(session, person)


async def get_person(
    session: AsyncSession,
    *,
    person_id: UUID,
    include_deleted: bool = False,
) -> Person | None:
    """Load a person by identifier."""
    stmt = select(Person).where(Person.id == person_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(Person.deleted_at.is_(None))
    person = (await session.execute(stmt)).scalar_one_or_none()
    if person is None:
        return None
    return await _attach_tags(session, person)


async def list_people(
    session: AsyncSession,
    *,
    search: str | None = None,
    tag_id: UUID | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Person]:
    """List people, optionally filtered by search or tag."""
    stmt = select(Person)
    if not include_deleted:
        stmt = stmt.where(Person.deleted_at.is_(None))
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Person.name.ilike(pattern),
                cast(Person.nicknames, Text).ilike(pattern),
                Person.location.ilike(pattern),
            )
        )
    if tag_id is not None:
        stmt = stmt.join(
            tag_associations,
            (tag_associations.c.entity_id == Person.id)
            & (tag_associations.c.entity_type == "person"),
        ).where(tag_associations.c.tag_id == tag_id)
    stmt = stmt.order_by(Person.created_at.desc(), Person.id.desc()).offset(offset).limit(limit)
    people = list((await session.execute(stmt)).scalars())
    if not people:
        return []
    tags_map = await load_tags_for_entities(
        session,
        entity_ids=[person.id for person in people],
        entity_type="person",
    )
    for person in people:
        setattr(person, "tags", tags_map.get(person.id, []))
    return people


async def update_person(
    session: AsyncSession,
    *,
    person_id: UUID,
    name: str | None = None,
    description: str | None = None,
    nicknames: list[str] | None = None,
    birth_date: date | None = None,
    location: str | None = None,
    tag_ids: list[UUID] | None = None,
) -> Person:
    """Update a person."""
    person = await get_person(session, person_id=person_id)
    if person is None:
        raise PersonNotFoundError(f"Person {person_id} was not found")
    if name is not None:
        normalized_name = name.strip()
        conflict = await session.execute(
            select(Person.id).where(
                Person.name == normalized_name,
                Person.id != person_id,
                Person.deleted_at.is_(None),
            )
        )
        if conflict.scalar_one_or_none() is not None:
            raise PersonAlreadyExistsError(f"Person with name {normalized_name!r} already exists")
        person.name = normalized_name
    if description is not None:
        person.description = description
    if nicknames is not None:
        person.nicknames = nicknames
    if birth_date is not None:
        person.birth_date = birth_date
    if location is not None:
        person.location = location
    if tag_ids is not None:
        await sync_entity_tags(
            session,
            entity_id=person.id,
            entity_type="person",
            desired_tag_ids=tag_ids,
        )
    await session.flush()
    await session.refresh(person)
    return await _attach_tags(session, person)


async def delete_person(
    session: AsyncSession,
    *,
    person_id: UUID,
    hard_delete: bool = False,
) -> None:
    """Delete a person."""
    person = await get_person(session, person_id=person_id, include_deleted=hard_delete)
    if person is None:
        raise PersonNotFoundError(f"Person {person_id} was not found")
    if hard_delete:
        await session.delete(person)
    else:
        person.soft_delete()
        await session.flush()
