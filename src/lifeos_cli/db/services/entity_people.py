"""Helpers for generic entity-to-person links."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.person import Person
from lifeos_cli.db.models.person_association import person_associations


async def sync_entity_people(
    session: AsyncSession,
    *,
    entity_id: UUID,
    entity_type: str,
    desired_person_ids: list[UUID],
) -> None:
    """Replace an entity's linked people with the provided identifiers."""
    unique_person_ids = list(dict.fromkeys(desired_person_ids))
    existing_stmt = select(Person.id).where(
        Person.id.in_(unique_person_ids),
        Person.deleted_at.is_(None),
    )
    existing_rows = await session.execute(existing_stmt)
    existing_person_ids = set(existing_rows.scalars().all())

    missing = [str(person_id) for person_id in unique_person_ids if person_id not in existing_person_ids]
    if missing:
        raise LookupError(f"Unknown person IDs for entity type {entity_type}: {', '.join(missing)}")

    await session.execute(
        delete(person_associations).where(
            person_associations.c.entity_id == entity_id,
            person_associations.c.entity_type == entity_type,
        )
    )
    for person_id in unique_person_ids:
        await session.execute(
            person_associations.insert().values(
                entity_id=entity_id,
                entity_type=entity_type,
                person_id=person_id,
            )
        )


async def load_people_for_entities(
    session: AsyncSession,
    *,
    entity_ids: list[UUID],
    entity_type: str,
) -> dict[UUID, list[Person]]:
    """Return people grouped by entity identifier."""
    if not entity_ids:
        return {}

    stmt = (
        select(person_associations.c.entity_id, Person)
        .join(Person, Person.id == person_associations.c.person_id)
        .where(
            person_associations.c.entity_type == entity_type,
            person_associations.c.entity_id.in_(entity_ids),
            Person.deleted_at.is_(None),
        )
        .order_by(Person.name.asc(), Person.id.asc())
    )
    rows = await session.execute(stmt)
    grouped: defaultdict[UUID, list[Person]] = defaultdict(list)
    for entity_id, person in rows.all():
        grouped[entity_id].append(person)
    return dict(grouped)
