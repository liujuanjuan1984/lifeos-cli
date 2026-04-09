"""Async CRUD helpers for visions."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services.batching import BatchDeleteResult

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
    await session.refresh(vision)
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
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_visions(
    session: AsyncSession,
    *,
    status: str | None = None,
    area_id: UUID | None = None,
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
    stmt = stmt.order_by(Vision.created_at.desc(), Vision.id.desc()).offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


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
    await session.flush()
    await session.refresh(vision)
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
