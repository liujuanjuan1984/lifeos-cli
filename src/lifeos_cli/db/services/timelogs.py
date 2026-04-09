"""Async CRUD helpers for timelogs."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.models.timelog import Timelog
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.entity_tags import load_tags_for_entities, sync_entity_tags
from lifeos_cli.db.services.timelog_support import (
    TimelogAreaReferenceNotFoundError,
    TimelogNotFoundError,
    TimelogTaskReferenceNotFoundError,
    TimelogValidationError,
    deduplicate_timelog_ids,
    ensure_timelog_area_exists,
    ensure_timelog_task_exists,
    validate_energy_level,
    validate_timelog_time_range,
    validate_timelog_title,
    validate_tracking_method,
)


async def _attach_timelog_links(session: AsyncSession, timelog: Timelog) -> Timelog:
    tags_map = await load_tags_for_entities(session, entity_ids=[timelog.id], entity_type="timelog")
    people_map = await load_people_for_entities(
        session, entity_ids=[timelog.id], entity_type="timelog"
    )
    timelog.tags = tags_map.get(timelog.id, [])
    timelog.people = people_map.get(timelog.id, [])
    return timelog


async def _attach_timelog_links_for_many(
    session: AsyncSession,
    timelogs: list[Timelog],
) -> list[Timelog]:
    if not timelogs:
        return []
    timelog_ids = [timelog.id for timelog in timelogs]
    tags_map = await load_tags_for_entities(session, entity_ids=timelog_ids, entity_type="timelog")
    people_map = await load_people_for_entities(
        session, entity_ids=timelog_ids, entity_type="timelog"
    )
    for timelog in timelogs:
        timelog.tags = tags_map.get(timelog.id, [])
        timelog.people = people_map.get(timelog.id, [])
    return timelogs


async def create_timelog(
    session: AsyncSession,
    *,
    title: str,
    start_time: datetime,
    end_time: datetime,
    tracking_method: str = "manual",
    location: str | None = None,
    energy_level: int | None = None,
    notes: str | None = None,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    tag_ids: list[UUID] | None = None,
    person_ids: list[UUID] | None = None,
) -> Timelog:
    """Create a new timelog."""
    normalized_title = validate_timelog_title(title)
    validate_timelog_time_range(start_time=start_time, end_time=end_time)
    normalized_tracking_method = validate_tracking_method(tracking_method)
    normalized_energy_level = validate_energy_level(energy_level)
    await ensure_timelog_area_exists(session, area_id)
    await ensure_timelog_task_exists(session, task_id)
    timelog = Timelog(
        title=normalized_title,
        start_time=start_time,
        end_time=end_time,
        tracking_method=normalized_tracking_method,
        location=location,
        energy_level=normalized_energy_level,
        notes=notes,
        area_id=area_id,
        task_id=task_id,
    )
    session.add(timelog)
    await session.flush()
    if tag_ids is not None:
        await sync_entity_tags(
            session, entity_id=timelog.id, entity_type="timelog", desired_tag_ids=tag_ids
        )
    if person_ids is not None:
        await sync_entity_people(
            session,
            entity_id=timelog.id,
            entity_type="timelog",
            desired_person_ids=person_ids,
        )
    await session.refresh(timelog)
    return await _attach_timelog_links(session, timelog)


async def get_timelog(
    session: AsyncSession,
    *,
    timelog_id: UUID,
    include_deleted: bool = False,
) -> Timelog | None:
    """Load a timelog by identifier."""
    stmt = (
        select(Timelog)
        .options(selectinload(Timelog.area), selectinload(Timelog.task))
        .where(Timelog.id == timelog_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(Timelog.deleted_at.is_(None))
    timelog = (await session.execute(stmt)).scalar_one_or_none()
    if timelog is None:
        return None
    return await _attach_timelog_links(session, timelog)


async def list_timelogs(
    session: AsyncSession,
    *,
    title_contains: str | None = None,
    tracking_method: str | None = None,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Timelog]:
    """List timelogs with optional filters."""
    stmt = select(Timelog).options(selectinload(Timelog.area), selectinload(Timelog.task))
    if not include_deleted:
        stmt = stmt.where(Timelog.deleted_at.is_(None))
    if title_contains:
        stmt = stmt.where(Timelog.title.ilike(f"%{title_contains.strip()}%"))
    if tracking_method is not None:
        stmt = stmt.where(Timelog.tracking_method == validate_tracking_method(tracking_method))
    if area_id is not None:
        stmt = stmt.where(Timelog.area_id == area_id)
    if task_id is not None:
        stmt = stmt.where(Timelog.task_id == task_id)
    if person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Timelog.id)
            & (person_associations.c.entity_type == "timelog"),
        ).where(person_associations.c.person_id == person_id)
    if tag_id is not None:
        stmt = stmt.join(
            tag_associations,
            (tag_associations.c.entity_id == Timelog.id)
            & (tag_associations.c.entity_type == "timelog"),
        ).where(tag_associations.c.tag_id == tag_id)
    if window_start is not None:
        stmt = stmt.where(Timelog.end_time >= window_start)
    if window_end is not None:
        stmt = stmt.where(Timelog.start_time <= window_end)
    stmt = stmt.order_by(Timelog.start_time.desc(), Timelog.id.desc()).offset(offset).limit(limit)
    timelogs = list((await session.execute(stmt)).scalars())
    return await _attach_timelog_links_for_many(session, timelogs)


async def update_timelog(
    session: AsyncSession,
    *,
    timelog_id: UUID,
    title: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    tracking_method: str | None = None,
    location: str | None = None,
    clear_location: bool = False,
    energy_level: int | None = None,
    clear_energy_level: bool = False,
    notes: str | None = None,
    clear_notes: bool = False,
    area_id: UUID | None = None,
    clear_area: bool = False,
    task_id: UUID | None = None,
    clear_task: bool = False,
    tag_ids: list[UUID] | None = None,
    clear_tags: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> Timelog:
    """Update one timelog."""
    timelog = await get_timelog(session, timelog_id=timelog_id, include_deleted=False)
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")

    next_start_time = start_time if start_time is not None else timelog.start_time
    next_end_time = end_time if end_time is not None else timelog.end_time
    validate_timelog_time_range(start_time=next_start_time, end_time=next_end_time)

    if title is not None:
        timelog.title = validate_timelog_title(title)
    if start_time is not None:
        timelog.start_time = start_time
    if end_time is not None:
        timelog.end_time = end_time
    if tracking_method is not None:
        timelog.tracking_method = validate_tracking_method(tracking_method)
    if clear_location:
        timelog.location = None
    elif location is not None:
        timelog.location = location
    if clear_energy_level:
        timelog.energy_level = None
    elif energy_level is not None:
        timelog.energy_level = validate_energy_level(energy_level)
    if clear_notes:
        timelog.notes = None
    elif notes is not None:
        timelog.notes = notes
    if clear_area:
        timelog.area_id = None
    elif area_id is not None:
        await ensure_timelog_area_exists(session, area_id)
        timelog.area_id = area_id
    if clear_task:
        timelog.task_id = None
    elif task_id is not None:
        await ensure_timelog_task_exists(session, task_id)
        timelog.task_id = task_id
    if clear_tags:
        await sync_entity_tags(
            session, entity_id=timelog.id, entity_type="timelog", desired_tag_ids=[]
        )
    elif tag_ids is not None:
        await sync_entity_tags(
            session, entity_id=timelog.id, entity_type="timelog", desired_tag_ids=tag_ids
        )
    if clear_people:
        await sync_entity_people(
            session, entity_id=timelog.id, entity_type="timelog", desired_person_ids=[]
        )
    elif person_ids is not None:
        await sync_entity_people(
            session,
            entity_id=timelog.id,
            entity_type="timelog",
            desired_person_ids=person_ids,
        )
    await session.flush()
    await session.refresh(timelog)
    return await _attach_timelog_links(session, timelog)


async def delete_timelog(session: AsyncSession, *, timelog_id: UUID) -> None:
    """Soft-delete one timelog."""
    timelog = await get_timelog(session, timelog_id=timelog_id, include_deleted=False)
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
    timelog.soft_delete()
    await session.flush()


async def batch_delete_timelogs(
    session: AsyncSession,
    *,
    timelog_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple timelogs."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []
    for timelog_id in deduplicate_timelog_ids(timelog_ids):
        try:
            await delete_timelog(session, timelog_id=timelog_id)
            deleted_count += 1
        except TimelogNotFoundError as exc:
            failed_ids.append(timelog_id)
            errors.append(str(exc))
    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )


__all__ = [
    "TimelogAreaReferenceNotFoundError",
    "TimelogNotFoundError",
    "TimelogTaskReferenceNotFoundError",
    "TimelogValidationError",
    "batch_delete_timelogs",
    "create_timelog",
    "delete_timelog",
    "get_timelog",
    "list_timelogs",
    "update_timelog",
]
