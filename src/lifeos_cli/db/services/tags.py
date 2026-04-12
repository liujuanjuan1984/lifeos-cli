"""Async CRUD helpers for tags."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag import Tag
from lifeos_cli.db.services.batching import BatchDeleteResult, batch_delete_records
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.read_models import TagView, build_tag_view

VALID_TAG_ENTITY_TYPES = {"note", "person", "task", "vision", "area", "event", "timelog"}


class TagNotFoundError(LookupError):
    """Raised when a tag cannot be found."""


class TagAlreadyExistsError(ValueError):
    """Raised when a tag with the same identity already exists."""


class InvalidTagEntityTypeError(ValueError):
    """Raised when an unsupported tag entity type is requested."""


def _deduplicate_tag_ids(tag_ids: list[UUID]) -> list[UUID]:
    """Return tag identifiers in their original order without duplicates."""
    return list(dict.fromkeys(tag_ids))


def normalize_tag_name(name: str) -> str:
    """Normalize a tag name."""
    normalized = name.strip().lower()
    if not normalized:
        raise ValueError("Tag name must not be empty")
    return normalized


def validate_tag_entity_type(entity_type: str) -> str:
    """Validate a tag entity type."""
    normalized = entity_type.strip().lower()
    if normalized not in VALID_TAG_ENTITY_TYPES:
        allowed = ", ".join(sorted(VALID_TAG_ENTITY_TYPES))
        raise InvalidTagEntityTypeError(
            f"Unsupported tag entity type {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


async def create_tag(
    session: AsyncSession,
    *,
    name: str,
    entity_type: str,
    category: str = "general",
    description: str | None = None,
    color: str | None = None,
    person_ids: list[UUID] | None = None,
) -> TagView:
    """Create a new tag."""
    normalized_name = normalize_tag_name(name)
    normalized_entity_type = validate_tag_entity_type(entity_type)
    normalized_category = category.strip().lower() or "general"
    existing = await session.execute(
        select(Tag).where(
            Tag.name == normalized_name,
            Tag.entity_type == normalized_entity_type,
            Tag.category == normalized_category,
            Tag.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise TagAlreadyExistsError(
            "Tag with the same name, entity type, and category already exists"
        )
    tag = Tag(
        name=normalized_name,
        entity_type=normalized_entity_type,
        category=normalized_category,
        description=description,
        color=color,
    )
    session.add(tag)
    await session.flush()
    if person_ids is not None:
        await sync_entity_people(
            session, entity_id=tag.id, entity_type="tag", desired_person_ids=person_ids
        )
    await session.refresh(tag)
    return await _build_tag_view(session, tag)


async def _get_tag_model(
    session: AsyncSession,
    *,
    tag_id: UUID,
    include_deleted: bool,
) -> Tag | None:
    stmt = select(Tag).where(Tag.id == tag_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(Tag.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def _build_tag_view(session: AsyncSession, tag: Tag) -> TagView:
    people_map = await load_people_for_entities(session, entity_ids=[tag.id], entity_type="tag")
    return build_tag_view(tag, people=people_map.get(tag.id, ()))


async def _build_tag_views(session: AsyncSession, tags: list[Tag]) -> list[TagView]:
    if not tags:
        return []
    people_map = await load_people_for_entities(
        session,
        entity_ids=[tag.id for tag in tags],
        entity_type="tag",
    )
    return [build_tag_view(tag, people=people_map.get(tag.id, ())) for tag in tags]


async def get_tag(
    session: AsyncSession,
    *,
    tag_id: UUID,
    include_deleted: bool = False,
) -> TagView | None:
    """Load a tag by identifier."""
    tag = await _get_tag_model(session, tag_id=tag_id, include_deleted=include_deleted)
    if tag is None:
        return None
    return await _build_tag_view(session, tag)


async def list_tags(
    session: AsyncSession,
    *,
    entity_type: str | None = None,
    category: str | None = None,
    person_id: UUID | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[TagView]:
    """List tags with optional filters."""
    stmt = select(Tag)
    if not include_deleted:
        stmt = stmt.where(Tag.deleted_at.is_(None))
    if entity_type is not None:
        stmt = stmt.where(Tag.entity_type == validate_tag_entity_type(entity_type))
    if category is not None:
        stmt = stmt.where(Tag.category == category.strip().lower())
    if person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Tag.id)
            & (person_associations.c.entity_type == "tag"),
        ).where(person_associations.c.person_id == person_id)
    stmt = stmt.order_by(Tag.name.asc(), Tag.id.asc()).offset(offset).limit(limit)
    tags = list((await session.execute(stmt)).scalars())
    return await _build_tag_views(session, tags)


async def update_tag(
    session: AsyncSession,
    *,
    tag_id: UUID,
    name: str | None = None,
    entity_type: str | None = None,
    category: str | None = None,
    description: str | None = None,
    clear_description: bool = False,
    color: str | None = None,
    clear_color: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> TagView:
    """Update a tag."""
    tag = await _get_tag_model(session, tag_id=tag_id, include_deleted=False)
    if tag is None:
        raise TagNotFoundError(f"Tag {tag_id} was not found")
    next_name = normalize_tag_name(name) if name is not None else tag.name
    next_entity_type = validate_tag_entity_type(entity_type) if entity_type else tag.entity_type
    next_category = category.strip().lower() if category is not None else tag.category
    conflict = await session.execute(
        select(Tag.id).where(
            Tag.name == next_name,
            Tag.entity_type == next_entity_type,
            Tag.category == next_category,
            Tag.id != tag_id,
            Tag.deleted_at.is_(None),
        )
    )
    if conflict.scalar_one_or_none() is not None:
        raise TagAlreadyExistsError(
            "Tag with the same name, entity type, and category already exists"
        )
    tag.name = next_name
    tag.entity_type = next_entity_type
    tag.category = next_category
    if clear_description:
        tag.description = None
    elif description is not None:
        tag.description = description
    if clear_color:
        tag.color = None
    elif color is not None:
        tag.color = color
    if clear_people:
        await sync_entity_people(
            session, entity_id=tag.id, entity_type="tag", desired_person_ids=[]
        )
    elif person_ids is not None:
        await sync_entity_people(
            session, entity_id=tag.id, entity_type="tag", desired_person_ids=person_ids
        )
    await session.flush()
    await session.refresh(tag)
    return await _build_tag_view(session, tag)


async def delete_tag(session: AsyncSession, *, tag_id: UUID) -> None:
    """Soft-delete a tag."""
    tag = await _get_tag_model(session, tag_id=tag_id, include_deleted=False)
    if tag is None:
        raise TagNotFoundError(f"Tag {tag_id} was not found")
    tag.soft_delete()
    await session.flush()


async def batch_delete_tags(
    session: AsyncSession,
    *,
    tag_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple tags while preserving per-tag error reporting."""
    return await batch_delete_records(
        identifiers=_deduplicate_tag_ids(tag_ids),
        delete_record=lambda tag_id: delete_tag(session, tag_id=tag_id),
        handled_exceptions=(TagNotFoundError,),
    )
