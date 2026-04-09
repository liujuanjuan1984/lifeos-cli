"""Async CRUD helpers for areas."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area


class AreaNotFoundError(LookupError):
    """Raised when an area cannot be found."""


class AreaAlreadyExistsError(ValueError):
    """Raised when an area with the same name already exists."""


async def create_area(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    color: str = "#3B82F6",
    icon: str | None = None,
    is_active: bool = True,
    display_order: int = 0,
) -> Area:
    """Create a new area."""
    normalized_name = name.strip()
    existing = await session.execute(
        select(Area).where(Area.name == normalized_name, Area.deleted_at.is_(None)).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise AreaAlreadyExistsError(f"Area with name {normalized_name!r} already exists")
    area = Area(
        name=normalized_name,
        description=description,
        color=color,
        icon=icon,
        is_active=is_active,
        display_order=display_order,
    )
    session.add(area)
    await session.flush()
    await session.refresh(area)
    return area


async def get_area(
    session: AsyncSession,
    *,
    area_id: UUID,
    include_deleted: bool = False,
) -> Area | None:
    """Load an area by identifier."""
    stmt = select(Area).where(Area.id == area_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(Area.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_areas(
    session: AsyncSession,
    *,
    include_deleted: bool = False,
    include_inactive: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Area]:
    """List areas in display order."""
    stmt = select(Area)
    if not include_deleted:
        stmt = stmt.where(Area.deleted_at.is_(None))
    if not include_inactive:
        stmt = stmt.where(Area.is_active.is_(True))
    stmt = stmt.order_by(Area.display_order.asc(), Area.name.asc()).offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


async def update_area(
    session: AsyncSession,
    *,
    area_id: UUID,
    name: str | None = None,
    description: str | None = None,
    color: str | None = None,
    icon: str | None = None,
    is_active: bool | None = None,
    display_order: int | None = None,
) -> Area:
    """Update an area's mutable fields."""
    area = await get_area(session, area_id=area_id)
    if area is None:
        raise AreaNotFoundError(f"Area {area_id} was not found")
    if name is not None:
        normalized_name = name.strip()
        conflict = await session.execute(
            select(Area.id).where(
                Area.name == normalized_name,
                Area.id != area_id,
                Area.deleted_at.is_(None),
            )
        )
        if conflict.scalar_one_or_none() is not None:
            raise AreaAlreadyExistsError(f"Area with name {normalized_name!r} already exists")
        area.name = normalized_name
    if description is not None:
        area.description = description
    if color is not None:
        area.color = color
    if icon is not None:
        area.icon = icon
    if is_active is not None:
        area.is_active = is_active
    if display_order is not None:
        area.display_order = display_order
    await session.flush()
    await session.refresh(area)
    return area


async def delete_area(session: AsyncSession, *, area_id: UUID, hard_delete: bool = False) -> None:
    """Delete an area."""
    area = await get_area(session, area_id=area_id, include_deleted=hard_delete)
    if area is None:
        raise AreaNotFoundError(f"Area {area_id} was not found")
    if hard_delete:
        await session.delete(area)
    else:
        area.soft_delete()
        area.is_active = False
        await session.flush()
