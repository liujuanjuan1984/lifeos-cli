"""Async CRUD helpers for timelogs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.application.time_preferences import get_utc_window_for_local_date
from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.models.timelog import Timelog
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.entity_tags import load_tags_for_entities, sync_entity_tags
from lifeos_cli.db.services.task_effort import recompute_task_effort_after_timelog_change
from lifeos_cli.db.services.timelog_support import (
    TimelogAreaReferenceNotFoundError,
    TimelogNotFoundError,
    TimelogTaskReferenceNotFoundError,
    TimelogValidationError,
    deduplicate_timelog_ids,
    ensure_timelog_area_exists,
    ensure_timelog_task_exists,
    normalize_timelog_datetime,
    validate_energy_level,
    validate_timelog_time_range,
    validate_timelog_title,
    validate_tracking_method,
)


@dataclass(frozen=True)
class TimelogBatchUpdateResult:
    """Summary for a batch timelog update operation."""

    updated_count: int
    unchanged_ids: tuple[UUID, ...]
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]


@dataclass(frozen=True)
class TimelogBatchRestoreResult:
    """Summary for a batch timelog restore operation."""

    restored_count: int
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]


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


def _apply_timelog_filters(
    stmt: Any,
    *,
    title_contains: str | None = None,
    notes_contains: str | None = None,
    query: str | None = None,
    tracking_method: str | None = None,
    area_id: UUID | None = None,
    area_name: str | None = None,
    without_area: bool = False,
    task_id: UUID | None = None,
    without_task: bool = False,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    include_deleted: bool = False,
) -> Any:
    """Apply shared timelog list filters to a SQLAlchemy select."""
    if not include_deleted:
        stmt = stmt.where(Timelog.deleted_at.is_(None))
    if title_contains:
        stmt = stmt.where(Timelog.title.ilike(f"%{title_contains.strip()}%"))
    if notes_contains:
        stmt = stmt.where(Timelog.notes.ilike(f"%{notes_contains.strip()}%"))
    if query:
        keywords = [keyword.strip() for keyword in query.split() if keyword.strip()]
        if keywords:
            stmt = stmt.where(
                or_(
                    *(
                        or_(
                            Timelog.title.ilike(f"%{keyword}%"),
                            Timelog.notes.ilike(f"%{keyword}%"),
                        )
                        for keyword in keywords
                    )
                )
            )
    if tracking_method is not None:
        stmt = stmt.where(Timelog.tracking_method == validate_tracking_method(tracking_method))
    if without_area:
        stmt = stmt.where(Timelog.area_id.is_(None))
    elif area_id is not None:
        stmt = stmt.where(Timelog.area_id == area_id)
    if area_name:
        stmt = stmt.join(Area, Timelog.area_id == Area.id).where(
            Area.name == area_name.strip(),
            Area.deleted_at.is_(None),
        )
    if without_task:
        stmt = stmt.where(Timelog.task_id.is_(None))
    elif task_id is not None:
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
    return stmt


def _resolve_timelog_window(
    *,
    local_date: date | None,
    window_start: datetime | None,
    window_end: datetime | None,
) -> tuple[datetime | None, datetime | None]:
    if local_date is None:
        return window_start, window_end
    local_window_start, local_window_end_exclusive = get_utc_window_for_local_date(local_date)
    return local_window_start, local_window_end_exclusive - timedelta(microseconds=1)


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
    normalized_start_time = normalize_timelog_datetime(start_time, field_name="start_time")
    normalized_end_time = normalize_timelog_datetime(end_time, field_name="end_time")
    normalized_title = validate_timelog_title(title)
    validate_timelog_time_range(
        start_time=normalized_start_time,
        end_time=normalized_end_time,
    )
    normalized_tracking_method = validate_tracking_method(tracking_method)
    normalized_energy_level = validate_energy_level(energy_level)
    await ensure_timelog_area_exists(session, area_id)
    await ensure_timelog_task_exists(session, task_id)
    timelog = Timelog(
        title=normalized_title,
        start_time=normalized_start_time,
        end_time=normalized_end_time,
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
    if timelog.task_id is not None:
        await recompute_task_effort_after_timelog_change(
            session,
            old_task_id=None,
            new_task_id=timelog.task_id,
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
    notes_contains: str | None = None,
    query: str | None = None,
    tracking_method: str | None = None,
    area_id: UUID | None = None,
    area_name: str | None = None,
    without_area: bool = False,
    task_id: UUID | None = None,
    without_task: bool = False,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    local_date: date | None = None,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Timelog]:
    """List timelogs with optional filters."""
    window_start, window_end = _resolve_timelog_window(
        local_date=local_date,
        window_start=window_start,
        window_end=window_end,
    )
    stmt = select(Timelog).options(selectinload(Timelog.area), selectinload(Timelog.task))
    stmt = _apply_timelog_filters(
        stmt,
        title_contains=title_contains,
        notes_contains=notes_contains,
        query=query,
        tracking_method=tracking_method,
        area_id=area_id,
        area_name=area_name,
        without_area=without_area,
        task_id=task_id,
        without_task=without_task,
        person_id=person_id,
        tag_id=tag_id,
        window_start=window_start,
        window_end=window_end,
        include_deleted=include_deleted,
    )
    stmt = stmt.order_by(Timelog.start_time.desc(), Timelog.id.desc()).offset(offset).limit(limit)
    timelogs = list((await session.execute(stmt)).scalars())
    return await _attach_timelog_links_for_many(session, timelogs)


async def count_timelogs(
    session: AsyncSession,
    *,
    title_contains: str | None = None,
    notes_contains: str | None = None,
    query: str | None = None,
    tracking_method: str | None = None,
    area_id: UUID | None = None,
    area_name: str | None = None,
    without_area: bool = False,
    task_id: UUID | None = None,
    without_task: bool = False,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    local_date: date | None = None,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    include_deleted: bool = False,
) -> int:
    """Count timelogs with the same filters used by list_timelogs."""
    window_start, window_end = _resolve_timelog_window(
        local_date=local_date,
        window_start=window_start,
        window_end=window_end,
    )
    id_stmt = _apply_timelog_filters(
        select(Timelog.id),
        title_contains=title_contains,
        notes_contains=notes_contains,
        query=query,
        tracking_method=tracking_method,
        area_id=area_id,
        area_name=area_name,
        without_area=without_area,
        task_id=task_id,
        without_task=without_task,
        person_id=person_id,
        tag_id=tag_id,
        window_start=window_start,
        window_end=window_end,
        include_deleted=include_deleted,
    )
    count_stmt = select(func.count()).select_from(id_stmt.subquery())
    return int((await session.execute(count_stmt)).scalar_one())


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
    old_task_id = timelog.task_id

    normalized_start_time = (
        normalize_timelog_datetime(start_time, field_name="start_time") if start_time else None
    )
    normalized_end_time = (
        normalize_timelog_datetime(end_time, field_name="end_time") if end_time else None
    )
    next_start_time = (
        normalized_start_time if normalized_start_time is not None else timelog.start_time
    )
    next_end_time = normalized_end_time if normalized_end_time is not None else timelog.end_time
    validate_timelog_time_range(start_time=next_start_time, end_time=next_end_time)

    if title is not None:
        timelog.title = validate_timelog_title(title)
    if normalized_start_time is not None:
        timelog.start_time = normalized_start_time
    if normalized_end_time is not None:
        timelog.end_time = normalized_end_time
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
    await recompute_task_effort_after_timelog_change(
        session,
        old_task_id=old_task_id,
        new_task_id=timelog.task_id,
    )
    await session.flush()
    await session.refresh(timelog)
    return await _attach_timelog_links(session, timelog)


def _has_timelog_batch_update(
    *,
    title: str | None,
    find_title_text: str | None,
    area_id: UUID | None,
    clear_area: bool,
    task_id: UUID | None,
    clear_task: bool,
    tag_ids: list[UUID] | None,
    clear_tags: bool,
    person_ids: list[UUID] | None,
    clear_people: bool,
) -> bool:
    return any(
        (
            title is not None,
            find_title_text is not None,
            area_id is not None,
            clear_area,
            task_id is not None,
            clear_task,
            tag_ids is not None,
            clear_tags,
            person_ids is not None,
            clear_people,
        )
    )


async def batch_update_timelogs(
    session: AsyncSession,
    *,
    timelog_ids: list[UUID],
    title: str | None = None,
    find_title_text: str | None = None,
    replace_title_text: str = "",
    area_id: UUID | None = None,
    clear_area: bool = False,
    task_id: UUID | None = None,
    clear_task: bool = False,
    tag_ids: list[UUID] | None = None,
    clear_tags: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> TimelogBatchUpdateResult:
    """Update multiple active timelogs while preserving per-record errors."""
    if title is not None and find_title_text is not None:
        raise TimelogValidationError("Use either title or title find/replace, not both.")
    if find_title_text is not None and not find_title_text.strip():
        raise TimelogValidationError("Title find text must not be empty.")
    if not _has_timelog_batch_update(
        title=title,
        find_title_text=find_title_text,
        area_id=area_id,
        clear_area=clear_area,
        task_id=task_id,
        clear_task=clear_task,
        tag_ids=tag_ids,
        clear_tags=clear_tags,
        person_ids=person_ids,
        clear_people=clear_people,
    ):
        raise TimelogValidationError("At least one batch update option is required.")

    has_non_title_update = any(
        (
            area_id is not None,
            clear_area,
            task_id is not None,
            clear_task,
            tag_ids is not None,
            clear_tags,
            person_ids is not None,
            clear_people,
        )
    )
    updated_count = 0
    unchanged_ids: list[UUID] = []
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for timelog_id in deduplicate_timelog_ids(timelog_ids):
        try:
            next_title = title
            if find_title_text is not None:
                timelog = await get_timelog(
                    session,
                    timelog_id=timelog_id,
                    include_deleted=False,
                )
                if timelog is None:
                    raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
                replaced_title = timelog.title.replace(find_title_text, replace_title_text)
                if replaced_title != timelog.title:
                    next_title = replaced_title
                elif not has_non_title_update:
                    unchanged_ids.append(timelog_id)
                    continue

            await update_timelog(
                session,
                timelog_id=timelog_id,
                title=next_title,
                area_id=area_id,
                clear_area=clear_area,
                task_id=task_id,
                clear_task=clear_task,
                tag_ids=tag_ids,
                clear_tags=clear_tags,
                person_ids=person_ids,
                clear_people=clear_people,
            )
            updated_count += 1
        except (
            TimelogAreaReferenceNotFoundError,
            TimelogNotFoundError,
            TimelogTaskReferenceNotFoundError,
            TimelogValidationError,
            LookupError,
        ) as exc:
            failed_ids.append(timelog_id)
            errors.append(str(exc))

    return TimelogBatchUpdateResult(
        updated_count=updated_count,
        unchanged_ids=tuple(unchanged_ids),
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )


async def delete_timelog(session: AsyncSession, *, timelog_id: UUID) -> None:
    """Soft-delete one timelog."""
    timelog = await get_timelog(session, timelog_id=timelog_id, include_deleted=False)
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
    old_task_id = timelog.task_id
    timelog.soft_delete()
    await recompute_task_effort_after_timelog_change(
        session,
        old_task_id=old_task_id,
        new_task_id=None,
    )
    await session.flush()


async def restore_timelog(session: AsyncSession, *, timelog_id: UUID) -> Timelog:
    """Restore one soft-deleted timelog."""
    timelog = await get_timelog(session, timelog_id=timelog_id, include_deleted=True)
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
    if timelog.deleted_at is None:
        raise TimelogValidationError(f"Timelog {timelog_id} is not deleted")
    await ensure_timelog_area_exists(session, timelog.area_id)
    await ensure_timelog_task_exists(session, timelog.task_id)
    timelog.deleted_at = None
    await recompute_task_effort_after_timelog_change(
        session,
        old_task_id=None,
        new_task_id=timelog.task_id,
    )
    await session.flush()
    await session.refresh(timelog)
    return await _attach_timelog_links(session, timelog)


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


async def batch_restore_timelogs(
    session: AsyncSession,
    *,
    timelog_ids: list[UUID],
) -> TimelogBatchRestoreResult:
    """Restore multiple soft-deleted timelogs."""
    restored_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []
    for timelog_id in deduplicate_timelog_ids(timelog_ids):
        try:
            await restore_timelog(session, timelog_id=timelog_id)
            restored_count += 1
        except (
            TimelogAreaReferenceNotFoundError,
            TimelogNotFoundError,
            TimelogTaskReferenceNotFoundError,
            TimelogValidationError,
        ) as exc:
            failed_ids.append(timelog_id)
            errors.append(str(exc))
    return TimelogBatchRestoreResult(
        restored_count=restored_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )


__all__ = [
    "TimelogAreaReferenceNotFoundError",
    "TimelogBatchRestoreResult",
    "TimelogBatchUpdateResult",
    "TimelogNotFoundError",
    "TimelogTaskReferenceNotFoundError",
    "TimelogValidationError",
    "batch_delete_timelogs",
    "batch_restore_timelogs",
    "batch_update_timelogs",
    "create_timelog",
    "count_timelogs",
    "delete_timelog",
    "get_timelog",
    "list_timelogs",
    "restore_timelog",
    "update_timelog",
]
