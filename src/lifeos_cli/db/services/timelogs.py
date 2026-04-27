"""Async CRUD helpers for timelogs."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.application.time_preferences import (
    get_utc_window_for_local_date_range,
    to_storage_timezone,
)
from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.models.timelog import Timelog
from lifeos_cli.db.services.batching import (
    BatchDeleteResult,
    batch_delete_records,
)
from lifeos_cli.db.services.collection_utils import deduplicate_preserving_order
from lifeos_cli.db.services.entity_associations import count_sources_for_targets
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.entity_tags import load_tags_for_entities, sync_entity_tags
from lifeos_cli.db.services.read_models import TimelogView, build_timelog_view
from lifeos_cli.db.services.task_effort import recompute_task_effort_after_timelog_change
from lifeos_cli.db.services.timelog_stats import recompute_timelog_stats_groupby_area_after_change
from lifeos_cli.db.services.timelog_support import (
    TimelogAreaReferenceNotFoundError,
    TimelogBatchUpdateInput,
    TimelogCreateInput,
    TimelogListInput,
    TimelogNotFoundError,
    TimelogQueryFilters,
    TimelogTaskReferenceNotFoundError,
    TimelogUpdateInput,
    TimelogValidationError,
    ensure_timelog_area_exists,
    ensure_timelog_task_exists,
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


async def _build_timelog_views(
    session: AsyncSession,
    timelogs: list[Timelog],
) -> list[TimelogView]:
    if not timelogs:
        return []
    timelog_ids = [timelog.id for timelog in timelogs]
    tags_map = await load_tags_for_entities(session, entity_ids=timelog_ids, entity_type="timelog")
    people_map = await load_people_for_entities(
        session, entity_ids=timelog_ids, entity_type="timelog"
    )
    note_count_map = await count_sources_for_targets(
        session,
        source_model="note",
        target_model="timelog",
        target_ids=timelog_ids,
        link_type="captured_from",
    )
    return [
        build_timelog_view(
            timelog,
            tags=tags_map.get(timelog.id, ()),
            people=people_map.get(timelog.id, ()),
            linked_notes_count=note_count_map.get(timelog.id, 0),
        )
        for timelog in timelogs
    ]


async def _build_timelog_view(session: AsyncSession, timelog: Timelog) -> TimelogView:
    views = await _build_timelog_views(session, [timelog])
    return views[0]


async def _get_timelog_model(
    session: AsyncSession,
    *,
    timelog_id: UUID,
    include_deleted: bool,
) -> Timelog | None:
    stmt = (
        select(Timelog)
        .options(selectinload(Timelog.area), selectinload(Timelog.task))
        .where(Timelog.id == timelog_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(Timelog.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


@dataclass(frozen=True)
class _TimelogDependencySnapshot:
    task_id: UUID | None
    start_time: datetime | None
    end_time: datetime | None
    area_id: UUID | None


def _capture_timelog_dependency_snapshot(timelog: Timelog) -> _TimelogDependencySnapshot:
    return _TimelogDependencySnapshot(
        task_id=timelog.task_id,
        start_time=timelog.start_time,
        end_time=timelog.end_time,
        area_id=timelog.area_id,
    )


@dataclass(frozen=True)
class _TimelogDependencyChange:
    previous: _TimelogDependencySnapshot
    current: _TimelogDependencySnapshot


async def _recompute_timelog_dependents(
    session: AsyncSession,
    *,
    change: _TimelogDependencyChange,
) -> None:
    await recompute_task_effort_after_timelog_change(
        session,
        old_task_id=change.previous.task_id,
        new_task_id=change.current.task_id,
    )
    await recompute_timelog_stats_groupby_area_after_change(
        session,
        old_start_time=change.previous.start_time,
        old_end_time=change.previous.end_time,
        old_area_id=change.previous.area_id,
        new_start_time=change.current.start_time,
        new_end_time=change.current.end_time,
        new_area_id=change.current.area_id,
    )


async def _flush_and_recompute_timelog_dependents(
    session: AsyncSession,
    *,
    change: _TimelogDependencyChange,
) -> None:
    await session.flush()
    await _recompute_timelog_dependents(session, change=change)
    await session.flush()


def _resolve_timelog_times(
    timelog: Timelog,
    changes: TimelogUpdateInput,
) -> tuple[datetime | None, datetime | None]:
    normalized_start_time = to_storage_timezone(changes.start_time) if changes.start_time else None
    normalized_end_time = to_storage_timezone(changes.end_time) if changes.end_time else None
    next_start_time = (
        normalized_start_time if normalized_start_time is not None else timelog.start_time
    )
    next_end_time = normalized_end_time if normalized_end_time is not None else timelog.end_time
    validate_timelog_time_range(start_time=next_start_time, end_time=next_end_time)
    return normalized_start_time, normalized_end_time


def _apply_timelog_scalar_updates(
    timelog: Timelog,
    changes: TimelogUpdateInput,
    *,
    normalized_start_time: datetime | None,
    normalized_end_time: datetime | None,
) -> None:
    if changes.title is not None:
        timelog.title = validate_timelog_title(changes.title)
    if normalized_start_time is not None:
        timelog.start_time = normalized_start_time
    if normalized_end_time is not None:
        timelog.end_time = normalized_end_time
    if changes.tracking_method is not None:
        timelog.tracking_method = validate_tracking_method(changes.tracking_method)
    if changes.clear_location:
        timelog.location = None
    elif changes.location is not None:
        timelog.location = changes.location
    timelog.energy_level = (
        None
        if changes.clear_energy_level
        else validate_energy_level(changes.energy_level)
        if changes.energy_level is not None
        else timelog.energy_level
    )
    if changes.clear_notes:
        timelog.notes = None
    elif changes.notes is not None:
        timelog.notes = changes.notes


async def _apply_timelog_reference_updates(
    session: AsyncSession,
    *,
    timelog: Timelog,
    changes: TimelogUpdateInput,
) -> None:
    next_area_id = (
        None
        if changes.clear_area
        else changes.area_id
        if changes.area_id is not None
        else timelog.area_id
    )
    next_task_id = (
        None
        if changes.clear_task
        else changes.task_id
        if changes.task_id is not None
        else timelog.task_id
    )
    if next_area_id != timelog.area_id:
        await ensure_timelog_area_exists(session, next_area_id)
        timelog.area_id = next_area_id
    if next_task_id != timelog.task_id:
        await ensure_timelog_task_exists(session, next_task_id)
        timelog.task_id = next_task_id


async def _apply_timelog_association_updates(
    session: AsyncSession,
    *,
    timelog: Timelog,
    changes: TimelogUpdateInput,
) -> None:
    next_tag_ids = [] if changes.clear_tags else changes.tag_ids
    next_person_ids = [] if changes.clear_people else changes.person_ids
    if next_tag_ids is not None:
        await sync_entity_tags(
            session,
            entity_id=timelog.id,
            entity_type="timelog",
            desired_tag_ids=next_tag_ids,
        )
    if next_person_ids is not None:
        await sync_entity_people(
            session,
            entity_id=timelog.id,
            entity_type="timelog",
            desired_person_ids=next_person_ids,
        )


async def _resolve_batch_timelog_title(
    session: AsyncSession,
    *,
    timelog_id: UUID,
    changes: TimelogBatchUpdateInput,
) -> tuple[str | None, bool]:
    if changes.find_title_text is None:
        return changes.title, False
    timelog = await get_timelog(
        session,
        timelog_id=timelog_id,
        include_deleted=False,
    )
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
    replaced_title = timelog.title.replace(
        changes.find_title_text,
        changes.replace_title_text,
    )
    if replaced_title != timelog.title:
        return replaced_title, False
    return None, not changes.has_non_title_update()


def _apply_timelog_filters(stmt: Any, *, filters: TimelogQueryFilters) -> Any:
    """Apply shared timelog list filters to a SQLAlchemy select."""
    if not filters.include_deleted:
        stmt = stmt.where(Timelog.deleted_at.is_(None))
    stmt = _apply_timelog_text_filters(stmt, filters=filters)
    stmt = _apply_timelog_area_task_filters(stmt, filters=filters)
    stmt = _apply_timelog_association_filters(stmt, filters=filters)
    return _apply_timelog_window_filters(stmt, filters=filters)


def _apply_timelog_text_filters(stmt: Any, *, filters: TimelogQueryFilters) -> Any:
    if filters.title_contains:
        stmt = stmt.where(Timelog.title.ilike(f"%{filters.title_contains.strip()}%"))
    if filters.notes_contains:
        stmt = stmt.where(Timelog.notes.ilike(f"%{filters.notes_contains.strip()}%"))
    if filters.query:
        keywords = [keyword.strip() for keyword in filters.query.split() if keyword.strip()]
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
    if filters.tracking_method is not None:
        stmt = stmt.where(
            Timelog.tracking_method == validate_tracking_method(filters.tracking_method)
        )
    return stmt


def _apply_timelog_area_task_filters(stmt: Any, *, filters: TimelogQueryFilters) -> Any:
    if filters.without_area:
        stmt = stmt.where(Timelog.area_id.is_(None))
    elif filters.area_id is not None:
        stmt = stmt.where(Timelog.area_id == filters.area_id)
    if filters.area_name:
        stmt = stmt.join(Area, Timelog.area_id == Area.id).where(
            Area.name == filters.area_name.strip(),
            Area.deleted_at.is_(None),
        )
    if filters.without_task:
        stmt = stmt.where(Timelog.task_id.is_(None))
    elif filters.task_id is not None:
        stmt = stmt.where(Timelog.task_id == filters.task_id)
    return stmt


def _apply_timelog_association_filters(stmt: Any, *, filters: TimelogQueryFilters) -> Any:
    if filters.person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Timelog.id)
            & (person_associations.c.entity_type == "timelog"),
        ).where(person_associations.c.person_id == filters.person_id)
    if filters.tag_id is not None:
        stmt = stmt.join(
            tag_associations,
            (tag_associations.c.entity_id == Timelog.id)
            & (tag_associations.c.entity_type == "timelog"),
        ).where(tag_associations.c.tag_id == filters.tag_id)
    return stmt


def _apply_timelog_window_filters(stmt: Any, *, filters: TimelogQueryFilters) -> Any:
    if filters.date_values:
        date_windows = [
            get_utc_window_for_local_date_range(target_date, target_date)
            for target_date in filters.date_values
        ]
        return stmt.where(
            or_(
                *(
                    and_(Timelog.end_time >= window_start, Timelog.start_time <= window_end)
                    for window_start, window_end in date_windows
                )
            )
        )
    if filters.window_start is not None:
        stmt = stmt.where(Timelog.end_time >= filters.window_start)
    if filters.window_end is not None:
        stmt = stmt.where(Timelog.start_time <= filters.window_end)
    return stmt


def _resolve_timelog_filters(filters: TimelogQueryFilters) -> TimelogQueryFilters:
    if filters.date_values:
        return replace(
            filters,
            date_values=tuple(deduplicate_preserving_order(filters.date_values)),
        )
    if filters.start_date is not None and filters.end_date is not None:
        window_start, window_end = get_utc_window_for_local_date_range(
            filters.start_date,
            filters.end_date,
        )
        return replace(filters, window_start=window_start, window_end=window_end)
    return filters


async def create_timelog(
    session: AsyncSession,
    *,
    payload: TimelogCreateInput,
) -> TimelogView:
    """Create a new timelog."""
    normalized_start_time = to_storage_timezone(payload.start_time)
    normalized_end_time = to_storage_timezone(payload.end_time)
    normalized_title = validate_timelog_title(payload.title)
    validate_timelog_time_range(
        start_time=normalized_start_time,
        end_time=normalized_end_time,
    )
    normalized_tracking_method = validate_tracking_method(payload.tracking_method)
    normalized_energy_level = validate_energy_level(payload.energy_level)
    await ensure_timelog_area_exists(session, payload.area_id)
    await ensure_timelog_task_exists(session, payload.task_id)
    timelog = Timelog(
        title=normalized_title,
        start_time=normalized_start_time,
        end_time=normalized_end_time,
        tracking_method=normalized_tracking_method,
        location=payload.location,
        energy_level=normalized_energy_level,
        notes=payload.notes,
        area_id=payload.area_id,
        task_id=payload.task_id,
    )
    session.add(timelog)
    await session.flush()
    if payload.tag_ids is not None:
        await sync_entity_tags(
            session,
            entity_id=timelog.id,
            entity_type="timelog",
            desired_tag_ids=payload.tag_ids,
        )
    if payload.person_ids is not None:
        await sync_entity_people(
            session,
            entity_id=timelog.id,
            entity_type="timelog",
            desired_person_ids=payload.person_ids,
        )
    await _flush_and_recompute_timelog_dependents(
        session,
        change=_TimelogDependencyChange(
            previous=_TimelogDependencySnapshot(
                task_id=None,
                start_time=None,
                end_time=None,
                area_id=None,
            ),
            current=_capture_timelog_dependency_snapshot(timelog),
        ),
    )
    await session.refresh(timelog)
    return await _build_timelog_view(session, timelog)


async def get_timelog(
    session: AsyncSession,
    *,
    timelog_id: UUID,
    include_deleted: bool = False,
) -> TimelogView | None:
    """Load a timelog by identifier."""
    timelog = await _get_timelog_model(
        session,
        timelog_id=timelog_id,
        include_deleted=include_deleted,
    )
    if timelog is None:
        return None
    return await _build_timelog_view(session, timelog)


async def get_latest_timelog_end_time(session: AsyncSession) -> datetime | None:
    """Return the latest active timelog end time for quick-add cursor inheritance."""
    stmt = (
        select(Timelog.end_time)
        .where(Timelog.deleted_at.is_(None))
        .order_by(Timelog.end_time.desc(), Timelog.id.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_timelogs(
    session: AsyncSession,
    *,
    query: TimelogListInput,
) -> list[TimelogView]:
    """List timelogs with optional filters."""
    resolved_filters = _resolve_timelog_filters(query.filters)
    stmt = select(Timelog).options(selectinload(Timelog.area), selectinload(Timelog.task))
    stmt = _apply_timelog_filters(stmt, filters=resolved_filters)
    stmt = (
        stmt.order_by(Timelog.start_time.desc(), Timelog.id.desc())
        .offset(query.offset)
        .limit(query.limit)
    )
    timelogs = list((await session.execute(stmt)).scalars())
    return await _build_timelog_views(session, timelogs)


async def count_timelogs(
    session: AsyncSession,
    *,
    filters: TimelogQueryFilters,
) -> int:
    """Count timelogs with the same filters used by list_timelogs."""
    id_stmt = _apply_timelog_filters(
        select(Timelog.id),
        filters=_resolve_timelog_filters(filters),
    )
    count_stmt = select(func.count()).select_from(id_stmt.subquery())
    return int((await session.execute(count_stmt)).scalar_one())


async def update_timelog(
    session: AsyncSession,
    *,
    timelog_id: UUID,
    changes: TimelogUpdateInput,
) -> TimelogView:
    """Update one timelog."""
    timelog = await _get_timelog_model(session, timelog_id=timelog_id, include_deleted=False)
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
    previous_state = _capture_timelog_dependency_snapshot(timelog)
    normalized_start_time, normalized_end_time = _resolve_timelog_times(timelog, changes)
    _apply_timelog_scalar_updates(
        timelog,
        changes,
        normalized_start_time=normalized_start_time,
        normalized_end_time=normalized_end_time,
    )
    await _apply_timelog_reference_updates(session, timelog=timelog, changes=changes)
    await _apply_timelog_association_updates(session, timelog=timelog, changes=changes)
    await _flush_and_recompute_timelog_dependents(
        session,
        change=_TimelogDependencyChange(
            previous=previous_state,
            current=_capture_timelog_dependency_snapshot(timelog),
        ),
    )
    await session.refresh(timelog)
    return await _build_timelog_view(session, timelog)


async def batch_update_timelogs(
    session: AsyncSession,
    *,
    timelog_ids: list[UUID],
    changes: TimelogBatchUpdateInput,
) -> TimelogBatchUpdateResult:
    """Update multiple active timelogs while preserving per-record errors."""
    if changes.title is not None and changes.find_title_text is not None:
        raise TimelogValidationError("Use either title or title find/replace, not both.")
    if changes.find_title_text is not None and not changes.find_title_text.strip():
        raise TimelogValidationError("Title find text must not be empty.")
    if not changes.has_update():
        raise TimelogValidationError("At least one batch update option is required.")
    updated_count = 0
    unchanged_ids: list[UUID] = []
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for timelog_id in deduplicate_preserving_order(timelog_ids):
        try:
            next_title, unchanged = await _resolve_batch_timelog_title(
                session,
                timelog_id=timelog_id,
                changes=changes,
            )
            if unchanged:
                unchanged_ids.append(timelog_id)
                continue
            await update_timelog(
                session,
                timelog_id=timelog_id,
                changes=replace(changes.changes, title=next_title),
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
    timelog = await _get_timelog_model(session, timelog_id=timelog_id, include_deleted=False)
    if timelog is None:
        raise TimelogNotFoundError(f"Timelog {timelog_id} was not found")
    old_task_id = timelog.task_id
    old_area_id = timelog.area_id
    old_start_time = timelog.start_time
    old_end_time = timelog.end_time
    timelog.soft_delete()
    await _flush_and_recompute_timelog_dependents(
        session,
        change=_TimelogDependencyChange(
            previous=_TimelogDependencySnapshot(
                task_id=old_task_id,
                start_time=old_start_time,
                end_time=old_end_time,
                area_id=old_area_id,
            ),
            current=_TimelogDependencySnapshot(
                task_id=None,
                start_time=None,
                end_time=None,
                area_id=None,
            ),
        ),
    )


async def batch_delete_timelogs(
    session: AsyncSession,
    *,
    timelog_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple timelogs."""
    return await batch_delete_records(
        identifiers=deduplicate_preserving_order(timelog_ids),
        delete_record=lambda timelog_id: delete_timelog(session, timelog_id=timelog_id),
        handled_exceptions=(TimelogNotFoundError,),
    )
