"""Helpers for generic entity-to-tag links."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.tag import Tag
from lifeos_cli.db.models.tag_association import tag_associations


async def sync_entity_tags(
    session: AsyncSession,
    *,
    entity_id: UUID,
    entity_type: str,
    desired_tag_ids: list[UUID],
) -> None:
    """Replace an entity's tags with the provided identifiers."""
    unique_tag_ids = list(dict.fromkeys(desired_tag_ids))
    existing_stmt = select(Tag.id).where(
        Tag.id.in_(unique_tag_ids),
        Tag.entity_type == entity_type,
        Tag.deleted_at.is_(None),
    )
    existing_rows = await session.execute(existing_stmt)
    existing_tag_ids = set(existing_rows.scalars().all())

    missing = [str(tag_id) for tag_id in unique_tag_ids if tag_id not in existing_tag_ids]
    if missing:
        raise LookupError(f"Unknown tag IDs for entity type {entity_type}: {', '.join(missing)}")

    await session.execute(
        delete(tag_associations).where(
            tag_associations.c.entity_id == entity_id,
            tag_associations.c.entity_type == entity_type,
        )
    )
    for tag_id in unique_tag_ids:
        await session.execute(
            tag_associations.insert().values(
                entity_id=entity_id,
                entity_type=entity_type,
                tag_id=tag_id,
            )
        )


async def load_tags_for_entities(
    session: AsyncSession,
    *,
    entity_ids: list[UUID],
    entity_type: str,
) -> dict[UUID, list[Tag]]:
    """Return tags grouped by entity identifier."""
    if not entity_ids:
        return {}

    stmt = (
        select(tag_associations.c.entity_id, Tag)
        .join(Tag, Tag.id == tag_associations.c.tag_id)
        .where(
            tag_associations.c.entity_type == entity_type,
            tag_associations.c.entity_id.in_(entity_ids),
            Tag.deleted_at.is_(None),
        )
        .order_by(Tag.name.asc(), Tag.id.asc())
    )
    rows = await session.execute(stmt)
    grouped: defaultdict[UUID, list[Tag]] = defaultdict(list)
    for entity_id, tag in rows.all():
        grouped[entity_id].append(tag)
    return dict(grouped)
