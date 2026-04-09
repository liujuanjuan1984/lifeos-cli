"""Async CRUD helpers for visions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people

VALID_VISION_STATUSES = {"active", "archived", "fruit"}


class VisionNotFoundError(LookupError):
    """Raised when a vision cannot be found."""


class VisionAlreadyExistsError(ValueError):
    """Raised when a vision with the same name already exists."""


class AreaReferenceNotFoundError(LookupError):
    """Raised when a referenced area cannot be found."""


def _deduplicate_vision_ids(vision_ids: list[UUID]) -> list[UUID]:
    """Return vision identifiers in their original order without duplicates."""
    return list(dict.fromkeys(vision_ids))


def validate_vision_status(status: str) -> str:
    """Validate a vision status."""
    normalized = status.strip().lower()
    if normalized not in VALID_VISION_STATUSES:
        allowed = ", ".join(sorted(VALID_VISION_STATUSES))
        raise ValueError(f"Invalid vision status {normalized!r}. Expected one of: {allowed}")
    return normalized


async def _ensure_area_exists(session: AsyncSession, area_id: UUID | None) -> None:
    if area_id is None:
        return
    area = await session.execute(
        select(Area.id).where(Area.id == area_id, Area.deleted_at.is_(None)).limit(1)
    )
    if area.scalar_one_or_none() is None:
        raise AreaReferenceNotFoundError(f"Area {area_id} was not found")


async def create_vision(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    status: str = "active",
    area_id: UUID | None = None,
    experience_rate_per_hour: int | None = None,
    person_ids: list[UUID] | None = None,
) -> Vision:
    """Create a new vision."""
    normalized_name = name.strip()
    existing = await session.execute(
        select(Vision).where(Vision.name == normalized_name, Vision.deleted_at.is_(None)).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise VisionAlreadyExistsError(f"Vision with name {normalized_name!r} already exists")
    await _ensure_area_exists(session, area_id)
    vision = Vision(
        name=normalized_name,
        description=description,
        status=validate_vision_status(status),
        area_id=area_id,
        experience_rate_per_hour=experience_rate_per_hour,
    )
    session.add(vision)
    await session.flush()
    if person_ids is not None:
        await sync_entity_people(
            session, entity_id=vision.id, entity_type="vision", desired_person_ids=person_ids
        )
    await session.refresh(vision)
    people_map = await load_people_for_entities(
        session, entity_ids=[vision.id], entity_type="vision"
    )
    vision.people = people_map.get(vision.id, [])
    return vision


async def get_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
    include_deleted: bool = False,
) -> Vision | None:
    """Load a vision by identifier."""
    stmt = select(Vision).where(Vision.id == vision_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(Vision.deleted_at.is_(None))
    vision = (await session.execute(stmt)).scalar_one_or_none()
    if vision is None:
        return None
    people_map = await load_people_for_entities(
        session, entity_ids=[vision.id], entity_type="vision"
    )
    vision.people = people_map.get(vision.id, [])
    return vision


async def list_visions(
    session: AsyncSession,
    *,
    status: str | None = None,
    area_id: UUID | None = None,
    person_id: UUID | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Vision]:
    """List visions."""
    stmt = select(Vision)
    if not include_deleted:
        stmt = stmt.where(Vision.deleted_at.is_(None))
    if status is not None:
        stmt = stmt.where(Vision.status == validate_vision_status(status))
    if area_id is not None:
        stmt = stmt.where(Vision.area_id == area_id)
    if person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Vision.id)
            & (person_associations.c.entity_type == "vision"),
        ).where(person_associations.c.person_id == person_id)
    stmt = stmt.order_by(Vision.created_at.desc(), Vision.id.desc()).offset(offset).limit(limit)
    visions = list((await session.execute(stmt)).scalars())
    people_map = await load_people_for_entities(
        session,
        entity_ids=[vision.id for vision in visions],
        entity_type="vision",
    )
    for vision in visions:
        vision.people = people_map.get(vision.id, [])
    return visions


async def update_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
    name: str | None = None,
    description: str | None = None,
    clear_description: bool = False,
    status: str | None = None,
    area_id: UUID | None = None,
    clear_area: bool = False,
    experience_rate_per_hour: int | None = None,
    clear_experience_rate: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> Vision:
    """Update a vision."""
    vision = await get_vision(session, vision_id=vision_id)
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    if name is not None:
        normalized_name = name.strip()
        conflict = await session.execute(
            select(Vision.id).where(
                Vision.name == normalized_name,
                Vision.id != vision_id,
                Vision.deleted_at.is_(None),
            )
        )
        if conflict.scalar_one_or_none() is not None:
            raise VisionAlreadyExistsError(f"Vision with name {normalized_name!r} already exists")
        vision.name = normalized_name
    if clear_description:
        vision.description = None
    elif description is not None:
        vision.description = description
    if status is not None:
        vision.status = validate_vision_status(status)
    if clear_area:
        vision.area_id = None
    elif area_id is not None:
        await _ensure_area_exists(session, area_id)
        vision.area_id = area_id
    if clear_experience_rate:
        vision.experience_rate_per_hour = None
    elif experience_rate_per_hour is not None:
        vision.experience_rate_per_hour = experience_rate_per_hour
    if clear_people:
        await sync_entity_people(
            session, entity_id=vision.id, entity_type="vision", desired_person_ids=[]
        )
    elif person_ids is not None:
        await sync_entity_people(
            session, entity_id=vision.id, entity_type="vision", desired_person_ids=person_ids
        )
    await session.flush()
    await session.refresh(vision)
    people_map = await load_people_for_entities(
        session, entity_ids=[vision.id], entity_type="vision"
    )
    vision.people = people_map.get(vision.id, [])
    return vision


async def delete_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
) -> None:
    """Soft-delete a vision."""
    vision = await get_vision(session, vision_id=vision_id, include_deleted=False)
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    vision.soft_delete()
    await session.flush()


async def batch_delete_visions(
    session: AsyncSession,
    *,
    vision_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple visions while preserving per-vision error reporting."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for vision_id in _deduplicate_vision_ids(vision_ids):
        try:
            await delete_vision(session, vision_id=vision_id)
            deleted_count += 1
        except VisionNotFoundError as exc:
            failed_ids.append(vision_id)
            errors.append(str(exc))

    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )
