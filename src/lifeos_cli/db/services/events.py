"""Async CRUD helpers for events."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.application.time_preferences import get_utc_window_for_local_date_range
from lifeos_cli.db.models.event import Event
from lifeos_cli.db.models.event_occurrence_exception import EventOccurrenceException
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.services.batching import BatchDeleteResult, batch_delete_records
from lifeos_cli.db.services.collection_utils import deduplicate_preserving_order
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.entity_tags import load_tags_for_entities, sync_entity_tags
from lifeos_cli.db.services.event_support import (
    EventAreaReferenceNotFoundError,
    EventNotFoundError,
    EventTaskReferenceNotFoundError,
    EventValidationError,
    ensure_event_area_exists,
    ensure_event_task_exists,
    event_is_recurring,
    get_event_occurrence_index,
    get_event_occurrence_starts_in_range,
    get_previous_event_occurrence_start,
    normalize_event_datetime,
    normalize_optional_event_datetime,
    validate_event_instance_start,
    validate_event_priority,
    validate_event_recurrence,
    validate_event_scope,
    validate_event_status,
    validate_event_time_range,
    validate_event_title,
    validate_event_type,
)
from lifeos_cli.db.services.read_models import EventView, build_event_view


@dataclass(frozen=True)
class EventOccurrence:
    """Expanded event occurrence read model."""

    id: UUID
    title: str
    status: str
    event_type: str
    start_time: datetime
    end_time: datetime | None
    task_id: UUID | None
    deleted_at: datetime | None
    instance_start: datetime


async def _build_event_views(session: AsyncSession, events: list[Event]) -> list[EventView]:
    if not events:
        return []
    event_ids = [event.id for event in events]
    tags_map = await load_tags_for_entities(session, entity_ids=event_ids, entity_type="event")
    people_map = await load_people_for_entities(session, entity_ids=event_ids, entity_type="event")
    return [
        build_event_view(
            event,
            tags=tags_map.get(event.id, ()),
            people=people_map.get(event.id, ()),
        )
        for event in events
    ]


async def _build_event_view(session: AsyncSession, event: Event) -> EventView:
    views = await _build_event_views(session, [event])
    return views[0]


async def _get_event_model(
    session: AsyncSession,
    *,
    event_id: UUID,
    include_deleted: bool,
) -> Event | None:
    stmt = (
        select(Event)
        .options(selectinload(Event.area), selectinload(Event.task))
        .where(Event.id == event_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(Event.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


def _event_duration(event: Event | EventOccurrence) -> timedelta | None:
    end_time = event.end_time
    if end_time is None:
        return None
    return end_time - event.start_time


def _event_overlaps_window(
    event: Event | EventOccurrence,
    *,
    window_start: datetime,
    window_end: datetime,
) -> bool:
    end_time = event.end_time
    return event.start_time <= window_end and (end_time is None or end_time >= window_start)


def _event_occurrence_end(
    event: Event | EventOccurrence,
    *,
    occurrence_start: datetime,
) -> datetime | None:
    duration = _event_duration(event)
    return occurrence_start + duration if duration is not None else None


async def _record_skip_exception(
    session: AsyncSession,
    *,
    master_event_id: UUID,
    instance_start: datetime,
) -> None:
    stmt = (
        select(EventOccurrenceException)
        .where(
            EventOccurrenceException.master_event_id == master_event_id,
            EventOccurrenceException.instance_start == instance_start,
        )
        .limit(1)
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        existing.action = "skip"
        existing.deleted_at = None
        return
    session.add(
        EventOccurrenceException(
            master_event_id=master_event_id,
            action="skip",
            instance_start=instance_start,
        )
    )


async def _load_skip_exceptions(
    session: AsyncSession,
    *,
    master_event_ids: list[UUID],
) -> dict[UUID, set[datetime]]:
    if not master_event_ids:
        return {}
    stmt = select(EventOccurrenceException).where(
        EventOccurrenceException.master_event_id.in_(master_event_ids),
        EventOccurrenceException.deleted_at.is_(None),
    )
    rows = list((await session.execute(stmt)).scalars())
    result: dict[UUID, set[datetime]] = {}
    for row in rows:
        result.setdefault(row.master_event_id, set()).add(row.instance_start)
    return result


async def _get_override_event_for_instance(
    session: AsyncSession,
    *,
    master_event_id: UUID,
    instance_start: datetime,
) -> Event | None:
    stmt = (
        select(Event)
        .where(
            Event.deleted_at.is_(None),
            Event.recurrence_parent_event_id == master_event_id,
            Event.recurrence_instance_start == instance_start,
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


def _resolve_link_ids(
    *,
    explicit_ids: list[UUID] | None,
    clear_flag: bool,
    existing_ids: list[UUID] | None,
) -> list[UUID]:
    if clear_flag:
        return []
    if explicit_ids is not None:
        return explicit_ids
    return list(existing_ids or [])


async def _apply_event_links(
    session: AsyncSession,
    *,
    event: Event,
    tag_ids: list[UUID] | None,
    person_ids: list[UUID] | None,
) -> None:
    if tag_ids is not None:
        await sync_entity_tags(
            session,
            entity_id=event.id,
            entity_type="event",
            desired_tag_ids=tag_ids,
        )
    if person_ids is not None:
        await sync_entity_people(
            session,
            entity_id=event.id,
            entity_type="event",
            desired_person_ids=person_ids,
        )


def _apply_event_query_filters(
    stmt: Any,
    *,
    title_contains: str | None,
    normalized_status: str | None,
    normalized_event_type: str | None,
    area_id: UUID | None,
    task_id: UUID | None,
    person_id: UUID | None,
    tag_id: UUID | None,
) -> Any:
    if title_contains:
        stmt = stmt.where(Event.title.ilike(f"%{title_contains.strip()}%"))
    if normalized_status is not None:
        stmt = stmt.where(Event.status == normalized_status)
    if normalized_event_type is not None:
        stmt = stmt.where(Event.event_type == normalized_event_type)
    if area_id is not None:
        stmt = stmt.where(Event.area_id == area_id)
    if task_id is not None:
        stmt = stmt.where(Event.task_id == task_id)
    if person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Event.id)
            & (person_associations.c.entity_type == "event"),
        ).where(person_associations.c.person_id == person_id)
    if tag_id is not None:
        stmt = stmt.join(
            tag_associations,
            (tag_associations.c.entity_id == Event.id)
            & (tag_associations.c.entity_type == "event"),
        ).where(tag_associations.c.tag_id == tag_id)
    return stmt


def _build_event_values(
    *,
    title: str,
    start_time: datetime,
    end_time: datetime | None,
    description: str | None,
    priority: int,
    status: str,
    event_type: str,
    is_all_day: bool,
    area_id: UUID | None,
    task_id: UUID | None,
    recurrence_frequency: str | None,
    recurrence_interval: int | None,
    recurrence_count: int | None,
    recurrence_until: datetime | None,
    recurrence_parent_event_id: UUID | None,
    recurrence_instance_start: datetime | None,
) -> dict[str, object]:
    return {
        "title": title,
        "start_time": start_time,
        "end_time": end_time,
        "description": description,
        "priority": priority,
        "status": status,
        "event_type": event_type,
        "is_all_day": is_all_day,
        "area_id": area_id,
        "task_id": task_id,
        "recurrence_frequency": recurrence_frequency,
        "recurrence_interval": recurrence_interval,
        "recurrence_count": recurrence_count,
        "recurrence_until": recurrence_until,
        "recurrence_parent_event_id": recurrence_parent_event_id,
        "recurrence_instance_start": recurrence_instance_start,
    }


async def create_event(
    session: AsyncSession,
    *,
    title: str,
    start_time: datetime,
    end_time: datetime | None = None,
    description: str | None = None,
    priority: int = 0,
    status: str = "planned",
    event_type: str = "appointment",
    is_all_day: bool = False,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    tag_ids: list[UUID] | None = None,
    person_ids: list[UUID] | None = None,
    recurrence_frequency: str | None = None,
    recurrence_interval: int | None = None,
    recurrence_count: int | None = None,
    recurrence_until: datetime | None = None,
    recurrence_parent_event_id: UUID | None = None,
    recurrence_instance_start: datetime | None = None,
) -> EventView:
    """Create a new event."""
    normalized_start_time = normalize_event_datetime(start_time)
    normalized_end_time = normalize_optional_event_datetime(end_time)
    normalized_recurrence_until = normalize_optional_event_datetime(recurrence_until)
    normalized_instance_start = normalize_optional_event_datetime(recurrence_instance_start)
    normalized_title = validate_event_title(title)
    validate_event_time_range(start_time=normalized_start_time, end_time=normalized_end_time)
    normalized_priority = validate_event_priority(priority)
    normalized_status = validate_event_status(status)
    normalized_event_type = validate_event_type(event_type)
    (
        normalized_recurrence_frequency,
        normalized_recurrence_interval,
        normalized_recurrence_count,
        normalized_recurrence_until,
    ) = validate_event_recurrence(
        start_time=normalized_start_time,
        recurrence_frequency=recurrence_frequency,
        recurrence_interval=recurrence_interval,
        recurrence_count=recurrence_count,
        recurrence_until=normalized_recurrence_until,
    )
    await ensure_event_area_exists(session, area_id)
    await ensure_event_task_exists(session, task_id)
    event = Event(
        **_build_event_values(
            title=normalized_title,
            start_time=normalized_start_time,
            end_time=normalized_end_time,
            description=description,
            priority=normalized_priority,
            status=normalized_status,
            event_type=normalized_event_type,
            is_all_day=is_all_day,
            area_id=area_id,
            task_id=task_id,
            recurrence_frequency=normalized_recurrence_frequency,
            recurrence_interval=normalized_recurrence_interval,
            recurrence_count=normalized_recurrence_count,
            recurrence_until=normalized_recurrence_until,
            recurrence_parent_event_id=recurrence_parent_event_id,
            recurrence_instance_start=normalized_instance_start,
        )
    )
    session.add(event)
    await session.flush()
    await _apply_event_links(session, event=event, tag_ids=tag_ids, person_ids=person_ids)
    await session.refresh(event)
    return await _build_event_view(session, event)


async def get_event(
    session: AsyncSession,
    *,
    event_id: UUID,
    include_deleted: bool = False,
) -> EventView | None:
    """Load an event by identifier."""
    event = await _get_event_model(session, event_id=event_id, include_deleted=include_deleted)
    if event is None:
        return None
    return await _build_event_view(session, event)


async def list_event_occurrences(
    session: AsyncSession,
    *,
    window_start: datetime,
    window_end: datetime,
    title_contains: str | None = None,
    status: str | None = None,
    event_type: str | None = None,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    include_deleted: bool = False,
) -> list[EventOccurrence]:
    """List expanded event occurrences that overlap one time window."""
    normalized_status = validate_event_status(status) if status is not None else None
    normalized_event_type = validate_event_type(event_type) if event_type is not None else None

    master_stmt = select(Event).where(
        Event.recurrence_parent_event_id.is_(None),
        Event.start_time <= window_end,
        or_(
            Event.recurrence_frequency.is_not(None),
            Event.end_time.is_(None),
            Event.end_time >= window_start,
        ),
    )
    if not include_deleted:
        master_stmt = master_stmt.where(Event.deleted_at.is_(None))
    master_stmt = _apply_event_query_filters(
        master_stmt,
        title_contains=title_contains,
        normalized_status=normalized_status,
        normalized_event_type=normalized_event_type,
        area_id=area_id,
        task_id=task_id,
        person_id=person_id,
        tag_id=tag_id,
    )
    masters = list((await session.execute(master_stmt)).scalars())
    master_ids = [event.id for event in masters if event_is_recurring(event)]
    skip_map = await _load_skip_exceptions(session, master_event_ids=master_ids)

    override_stmt = select(Event).where(
        Event.recurrence_parent_event_id.is_not(None),
        Event.start_time <= window_end,
        or_(Event.end_time.is_(None), Event.end_time >= window_start),
    )
    if not include_deleted:
        override_stmt = override_stmt.where(Event.deleted_at.is_(None))
    override_stmt = _apply_event_query_filters(
        override_stmt,
        title_contains=title_contains,
        normalized_status=normalized_status,
        normalized_event_type=normalized_event_type,
        area_id=area_id,
        task_id=task_id,
        person_id=person_id,
        tag_id=tag_id,
    )
    overrides = list((await session.execute(override_stmt)).scalars())
    override_keys = {
        (override.recurrence_parent_event_id, override.recurrence_instance_start): override
        for override in overrides
        if override.recurrence_parent_event_id is not None
        and override.recurrence_instance_start is not None
    }

    occurrences: list[EventOccurrence] = []
    for master in masters:
        if not event_is_recurring(master):
            if _event_overlaps_window(master, window_start=window_start, window_end=window_end):
                occurrences.append(
                    EventOccurrence(
                        id=master.id,
                        title=master.title,
                        status=master.status,
                        event_type=master.event_type,
                        start_time=master.start_time,
                        end_time=master.end_time,
                        task_id=master.task_id,
                        deleted_at=master.deleted_at,
                        instance_start=master.start_time,
                    )
                )
            continue

        for occurrence_start in get_event_occurrence_starts_in_range(
            master,
            window_start=window_start,
            window_end=window_end,
        ):
            if occurrence_start in skip_map.get(master.id, set()):
                continue
            if (master.id, occurrence_start) in override_keys:
                continue
            occurrences.append(
                EventOccurrence(
                    id=master.id,
                    title=master.title,
                    status=master.status,
                    event_type=master.event_type,
                    start_time=occurrence_start,
                    end_time=_event_occurrence_end(master, occurrence_start=occurrence_start),
                    task_id=master.task_id,
                    deleted_at=master.deleted_at,
                    instance_start=occurrence_start,
                )
            )

    for override in overrides:
        occurrences.append(
            EventOccurrence(
                id=override.id,
                title=override.title,
                status=override.status,
                event_type=override.event_type,
                start_time=override.start_time,
                end_time=override.end_time,
                task_id=override.task_id,
                deleted_at=override.deleted_at,
                instance_start=override.recurrence_instance_start or override.start_time,
            )
        )

    return sorted(occurrences, key=lambda item: (item.start_time, item.id))


async def list_events(
    session: AsyncSession,
    *,
    title_contains: str | None = None,
    status: str | None = None,
    event_type: str | None = None,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[EventOccurrence | EventView]:
    """List events with optional filters."""
    normalized_status = validate_event_status(status) if status is not None else None
    normalized_event_type = validate_event_type(event_type) if event_type is not None else None

    if start_date is not None and end_date is not None:
        window_start, window_end = get_utc_window_for_local_date_range(start_date, end_date)

    if window_start is not None and window_end is not None:
        occurrences = await list_event_occurrences(
            session,
            window_start=window_start,
            window_end=window_end,
            title_contains=title_contains,
            status=normalized_status,
            event_type=normalized_event_type,
            area_id=area_id,
            task_id=task_id,
            person_id=person_id,
            tag_id=tag_id,
            include_deleted=include_deleted,
        )
        return list(occurrences[offset : offset + limit])

    stmt = select(Event).options(selectinload(Event.area), selectinload(Event.task))
    if not include_deleted:
        stmt = stmt.where(Event.deleted_at.is_(None))
    stmt = _apply_event_query_filters(
        stmt,
        title_contains=title_contains,
        normalized_status=normalized_status,
        normalized_event_type=normalized_event_type,
        area_id=area_id,
        task_id=task_id,
        person_id=person_id,
        tag_id=tag_id,
    )
    if window_start is not None:
        stmt = stmt.where(or_(Event.end_time.is_(None), Event.end_time >= window_start))
    if window_end is not None:
        stmt = stmt.where(Event.start_time <= window_end)
    stmt = stmt.order_by(Event.start_time.desc(), Event.id.desc()).offset(offset).limit(limit)
    events = list((await session.execute(stmt)).scalars())
    return list(await _build_event_views(session, events))


async def _update_event_record(
    session: AsyncSession,
    *,
    event: Event,
    title: str | None,
    description: str | None,
    clear_description: bool,
    start_time: datetime | None,
    end_time: datetime | None,
    clear_end_time: bool,
    priority: int | None,
    status: str | None,
    event_type: str | None,
    is_all_day: bool | None,
    area_id: UUID | None,
    clear_area: bool,
    task_id: UUID | None,
    clear_task: bool,
    tag_ids: list[UUID] | None,
    clear_tags: bool,
    person_ids: list[UUID] | None,
    clear_people: bool,
    recurrence_frequency: str | None,
    recurrence_interval: int | None,
    recurrence_count: int | None,
    recurrence_until: datetime | None,
    clear_recurrence: bool,
) -> EventView:
    normalized_start_time = normalize_optional_event_datetime(start_time)
    normalized_end_time = normalize_optional_event_datetime(end_time)
    normalized_recurrence_until = normalize_optional_event_datetime(recurrence_until)
    next_start_time = (
        normalized_start_time if normalized_start_time is not None else event.start_time
    )
    next_end_time = (
        None
        if clear_end_time
        else normalized_end_time
        if normalized_end_time is not None
        else event.end_time
    )
    validate_event_time_range(start_time=next_start_time, end_time=next_end_time)

    next_recurrence_frequency = (
        None
        if clear_recurrence
        else recurrence_frequency
        if recurrence_frequency is not None
        else event.recurrence_frequency
    )
    next_recurrence_interval = (
        None
        if clear_recurrence
        else recurrence_interval
        if recurrence_interval is not None
        else event.recurrence_interval
    )
    next_recurrence_count = (
        None
        if clear_recurrence
        else recurrence_count
        if recurrence_count is not None
        else event.recurrence_count
    )
    next_recurrence_until = (
        None
        if clear_recurrence
        else normalized_recurrence_until
        if normalized_recurrence_until is not None
        else event.recurrence_until
    )
    (
        validated_recurrence_frequency,
        validated_recurrence_interval,
        validated_recurrence_count,
        validated_recurrence_until,
    ) = validate_event_recurrence(
        start_time=next_start_time,
        recurrence_frequency=next_recurrence_frequency,
        recurrence_interval=next_recurrence_interval,
        recurrence_count=next_recurrence_count,
        recurrence_until=next_recurrence_until,
    )

    if title is not None:
        event.title = validate_event_title(title)
    if clear_description:
        event.description = None
    elif description is not None:
        event.description = description
    if normalized_start_time is not None:
        event.start_time = normalized_start_time
    if clear_end_time:
        event.end_time = None
    elif normalized_end_time is not None:
        event.end_time = normalized_end_time
    if priority is not None:
        event.priority = validate_event_priority(priority)
    if status is not None:
        event.status = validate_event_status(status)
    if event_type is not None:
        event.event_type = validate_event_type(event_type)
    if is_all_day is not None:
        event.is_all_day = is_all_day
    if clear_area:
        event.area_id = None
    elif area_id is not None:
        await ensure_event_area_exists(session, area_id)
        event.area_id = area_id
    if clear_task:
        event.task_id = None
    elif task_id is not None:
        await ensure_event_task_exists(session, task_id)
        event.task_id = task_id
    event.recurrence_frequency = validated_recurrence_frequency
    event.recurrence_interval = validated_recurrence_interval
    event.recurrence_count = validated_recurrence_count
    event.recurrence_until = validated_recurrence_until
    if clear_tags:
        await sync_entity_tags(session, entity_id=event.id, entity_type="event", desired_tag_ids=[])
    elif tag_ids is not None:
        await sync_entity_tags(
            session,
            entity_id=event.id,
            entity_type="event",
            desired_tag_ids=tag_ids,
        )
    if clear_people:
        await sync_entity_people(
            session,
            entity_id=event.id,
            entity_type="event",
            desired_person_ids=[],
        )
    elif person_ids is not None:
        await sync_entity_people(
            session,
            entity_id=event.id,
            entity_type="event",
            desired_person_ids=person_ids,
        )
    await session.flush()
    await session.refresh(event)
    return await _build_event_view(session, event)


async def _update_single_occurrence(
    session: AsyncSession,
    *,
    master_event: Event,
    instance_start: datetime,
    title: str | None,
    description: str | None,
    clear_description: bool,
    start_time: datetime | None,
    end_time: datetime | None,
    clear_end_time: bool,
    priority: int | None,
    status: str | None,
    event_type: str | None,
    is_all_day: bool | None,
    area_id: UUID | None,
    clear_area: bool,
    task_id: UUID | None,
    clear_task: bool,
    tag_ids: list[UUID] | None,
    clear_tags: bool,
    person_ids: list[UUID] | None,
    clear_people: bool,
) -> EventView:
    override_event_model = await _get_override_event_for_instance(
        session,
        master_event_id=master_event.id,
        instance_start=instance_start,
    )
    existing_tag_map = await load_tags_for_entities(
        session,
        entity_ids=[master_event.id],
        entity_type="event",
    )
    existing_people_map = await load_people_for_entities(
        session,
        entity_ids=[master_event.id],
        entity_type="event",
    )
    existing_tag_ids = [tag.id for tag in existing_tag_map.get(master_event.id, ())]
    existing_person_ids = [person.id for person in existing_people_map.get(master_event.id, ())]
    if override_event_model is None:
        override_start_time = start_time if start_time is not None else instance_start
        override_end_time = (
            None
            if clear_end_time
            else end_time
            if end_time is not None
            else _event_occurrence_end(master_event, occurrence_start=instance_start)
        )
        resolved_tag_ids = _resolve_link_ids(
            explicit_ids=tag_ids,
            clear_flag=clear_tags,
            existing_ids=existing_tag_ids,
        )
        resolved_person_ids = _resolve_link_ids(
            explicit_ids=person_ids,
            clear_flag=clear_people,
            existing_ids=existing_person_ids,
        )
        override_event_view = await create_event(
            session,
            title=title or master_event.title,
            description=None
            if clear_description
            else description
            if description is not None
            else master_event.description,
            start_time=override_start_time,
            end_time=override_end_time,
            priority=priority if priority is not None else master_event.priority,
            status=status or master_event.status,
            event_type=event_type or master_event.event_type,
            is_all_day=is_all_day if is_all_day is not None else master_event.is_all_day,
            area_id=(
                None if clear_area else area_id if area_id is not None else master_event.area_id
            ),
            task_id=(
                None if clear_task else task_id if task_id is not None else master_event.task_id
            ),
            tag_ids=resolved_tag_ids,
            person_ids=resolved_person_ids,
            recurrence_parent_event_id=master_event.id,
            recurrence_instance_start=instance_start,
        )
    else:
        override_event_view = await _update_event_record(
            session,
            event=override_event_model,
            title=title,
            description=description,
            clear_description=clear_description,
            start_time=start_time,
            end_time=end_time,
            clear_end_time=clear_end_time,
            priority=priority,
            status=status,
            event_type=event_type,
            is_all_day=is_all_day,
            area_id=area_id,
            clear_area=clear_area,
            task_id=task_id,
            clear_task=clear_task,
            tag_ids=tag_ids,
            clear_tags=clear_tags,
            person_ids=person_ids,
            clear_people=clear_people,
            recurrence_frequency=None,
            recurrence_interval=None,
            recurrence_count=None,
            recurrence_until=None,
            clear_recurrence=False,
        )
    await _record_skip_exception(
        session,
        master_event_id=master_event.id,
        instance_start=instance_start,
    )
    return override_event_view


async def _update_future_series(
    session: AsyncSession,
    *,
    master_event: Event,
    instance_start: datetime,
    title: str | None,
    description: str | None,
    clear_description: bool,
    start_time: datetime | None,
    end_time: datetime | None,
    clear_end_time: bool,
    priority: int | None,
    status: str | None,
    event_type: str | None,
    is_all_day: bool | None,
    area_id: UUID | None,
    clear_area: bool,
    task_id: UUID | None,
    clear_task: bool,
    tag_ids: list[UUID] | None,
    clear_tags: bool,
    person_ids: list[UUID] | None,
    clear_people: bool,
    recurrence_frequency: str | None,
    recurrence_interval: int | None,
    recurrence_count: int | None,
    recurrence_until: datetime | None,
    clear_recurrence: bool,
) -> EventView:
    previous_start = get_previous_event_occurrence_start(
        master_event,
        instance_start=instance_start,
    )
    if previous_start is None:
        return await _update_event_record(
            session,
            event=master_event,
            title=title,
            description=description,
            clear_description=clear_description,
            start_time=start_time,
            end_time=end_time,
            clear_end_time=clear_end_time,
            priority=priority,
            status=status,
            event_type=event_type,
            is_all_day=is_all_day,
            area_id=area_id,
            clear_area=clear_area,
            task_id=task_id,
            clear_task=clear_task,
            tag_ids=tag_ids,
            clear_tags=clear_tags,
            person_ids=person_ids,
            clear_people=clear_people,
            recurrence_frequency=recurrence_frequency,
            recurrence_interval=recurrence_interval,
            recurrence_count=recurrence_count,
            recurrence_until=recurrence_until,
            clear_recurrence=clear_recurrence,
        )

    master_event.recurrence_until = previous_start
    await session.flush()
    existing_tag_map = await load_tags_for_entities(
        session,
        entity_ids=[master_event.id],
        entity_type="event",
    )
    existing_people_map = await load_people_for_entities(
        session,
        entity_ids=[master_event.id],
        entity_type="event",
    )
    existing_tag_ids = [tag.id for tag in existing_tag_map.get(master_event.id, ())]
    existing_person_ids = [person.id for person in existing_people_map.get(master_event.id, ())]

    resolved_tag_ids = _resolve_link_ids(
        explicit_ids=tag_ids,
        clear_flag=clear_tags,
        existing_ids=existing_tag_ids,
    )
    resolved_person_ids = _resolve_link_ids(
        explicit_ids=person_ids,
        clear_flag=clear_people,
        existing_ids=existing_person_ids,
    )
    next_recurrence_frequency = (
        None
        if clear_recurrence
        else recurrence_frequency
        if recurrence_frequency is not None
        else master_event.recurrence_frequency
    )
    next_recurrence_interval = (
        None
        if clear_recurrence
        else recurrence_interval
        if recurrence_interval is not None
        else master_event.recurrence_interval
    )
    next_recurrence_count = recurrence_count
    if (
        next_recurrence_count is None
        and not clear_recurrence
        and master_event.recurrence_count is not None
    ):
        remaining = master_event.recurrence_count - get_event_occurrence_index(
            master_event,
            instance_start=instance_start,
        )
        next_recurrence_count = remaining
    next_recurrence_until = (
        None
        if clear_recurrence
        else recurrence_until
        if recurrence_until is not None
        else master_event.recurrence_until
    )
    return await create_event(
        session,
        title=title or master_event.title,
        description=None
        if clear_description
        else description
        if description is not None
        else master_event.description,
        start_time=start_time or instance_start,
        end_time=None
        if clear_end_time
        else end_time
        if end_time is not None
        else _event_occurrence_end(master_event, occurrence_start=instance_start),
        priority=priority if priority is not None else master_event.priority,
        status=status or master_event.status,
        event_type=event_type or master_event.event_type,
        is_all_day=is_all_day if is_all_day is not None else master_event.is_all_day,
        area_id=None if clear_area else area_id if area_id is not None else master_event.area_id,
        task_id=None if clear_task else task_id if task_id is not None else master_event.task_id,
        tag_ids=resolved_tag_ids,
        person_ids=resolved_person_ids,
        recurrence_frequency=next_recurrence_frequency,
        recurrence_interval=next_recurrence_interval,
        recurrence_count=next_recurrence_count,
        recurrence_until=next_recurrence_until,
    )


async def update_event(
    session: AsyncSession,
    *,
    event_id: UUID,
    title: str | None = None,
    description: str | None = None,
    clear_description: bool = False,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    clear_end_time: bool = False,
    priority: int | None = None,
    status: str | None = None,
    event_type: str | None = None,
    is_all_day: bool | None = None,
    area_id: UUID | None = None,
    clear_area: bool = False,
    task_id: UUID | None = None,
    clear_task: bool = False,
    tag_ids: list[UUID] | None = None,
    clear_tags: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
    recurrence_frequency: str | None = None,
    recurrence_interval: int | None = None,
    recurrence_count: int | None = None,
    recurrence_until: datetime | None = None,
    clear_recurrence: bool = False,
    scope: str = "all",
    instance_start: datetime | None = None,
) -> EventView:
    """Update one event."""
    event = await _get_event_model(session, event_id=event_id, include_deleted=False)
    if event is None:
        raise EventNotFoundError(f"Event {event_id} was not found")

    normalized_scope = validate_event_scope(scope)
    normalized_instance_start = normalize_optional_event_datetime(instance_start)
    if normalized_scope in {"single", "all_future"}:
        if normalized_instance_start is None:
            raise EventValidationError("Instance-level recurring updates require --instance-start.")
        validate_event_instance_start(event, instance_start=normalized_instance_start)
    if normalized_scope == "single":
        if normalized_instance_start is None:
            raise EventValidationError("Single-occurrence updates require --instance-start.")
        return await _update_single_occurrence(
            session,
            master_event=event,
            instance_start=normalized_instance_start,
            title=title,
            description=description,
            clear_description=clear_description,
            start_time=start_time,
            end_time=end_time,
            clear_end_time=clear_end_time,
            priority=priority,
            status=status,
            event_type=event_type,
            is_all_day=is_all_day,
            area_id=area_id,
            clear_area=clear_area,
            task_id=task_id,
            clear_task=clear_task,
            tag_ids=tag_ids,
            clear_tags=clear_tags,
            person_ids=person_ids,
            clear_people=clear_people,
        )
    if normalized_scope == "all_future":
        if normalized_instance_start is None:
            raise EventValidationError("Future-series updates require --instance-start.")
        return await _update_future_series(
            session,
            master_event=event,
            instance_start=normalized_instance_start,
            title=title,
            description=description,
            clear_description=clear_description,
            start_time=start_time,
            end_time=end_time,
            clear_end_time=clear_end_time,
            priority=priority,
            status=status,
            event_type=event_type,
            is_all_day=is_all_day,
            area_id=area_id,
            clear_area=clear_area,
            task_id=task_id,
            clear_task=clear_task,
            tag_ids=tag_ids,
            clear_tags=clear_tags,
            person_ids=person_ids,
            clear_people=clear_people,
            recurrence_frequency=recurrence_frequency,
            recurrence_interval=recurrence_interval,
            recurrence_count=recurrence_count,
            recurrence_until=recurrence_until,
            clear_recurrence=clear_recurrence,
        )
    return await _update_event_record(
        session,
        event=event,
        title=title,
        description=description,
        clear_description=clear_description,
        start_time=start_time,
        end_time=end_time,
        clear_end_time=clear_end_time,
        priority=priority,
        status=status,
        event_type=event_type,
        is_all_day=is_all_day,
        area_id=area_id,
        clear_area=clear_area,
        task_id=task_id,
        clear_task=clear_task,
        tag_ids=tag_ids,
        clear_tags=clear_tags,
        person_ids=person_ids,
        clear_people=clear_people,
        recurrence_frequency=recurrence_frequency,
        recurrence_interval=recurrence_interval,
        recurrence_count=recurrence_count,
        recurrence_until=recurrence_until,
        clear_recurrence=clear_recurrence,
    )


async def delete_event(
    session: AsyncSession,
    *,
    event_id: UUID,
    scope: str = "all",
    instance_start: datetime | None = None,
) -> None:
    """Soft-delete one event or one recurring slice."""
    event = await _get_event_model(session, event_id=event_id, include_deleted=False)
    if event is None:
        raise EventNotFoundError(f"Event {event_id} was not found")

    normalized_scope = validate_event_scope(scope)
    normalized_instance_start = normalize_optional_event_datetime(instance_start)
    if normalized_scope == "all":
        event.soft_delete()
        await session.flush()
        return

    if normalized_instance_start is None:
        raise EventValidationError("Instance-level recurring deletes require --instance-start.")
    validate_event_instance_start(event, instance_start=normalized_instance_start)

    if normalized_scope == "single":
        override_event = await _get_override_event_for_instance(
            session,
            master_event_id=event.id,
            instance_start=normalized_instance_start,
        )
        if override_event is not None:
            override_event.soft_delete()
        await _record_skip_exception(
            session,
            master_event_id=event.id,
            instance_start=normalized_instance_start,
        )
        await session.flush()
        return

    previous_start = get_previous_event_occurrence_start(
        event,
        instance_start=normalized_instance_start,
    )
    if previous_start is None:
        event.soft_delete()
    else:
        event.recurrence_until = previous_start
    await session.flush()


async def batch_delete_events(
    session: AsyncSession,
    *,
    event_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple events."""
    return await batch_delete_records(
        identifiers=deduplicate_preserving_order(event_ids),
        delete_record=lambda event_id: delete_event(session, event_id=event_id),
        handled_exceptions=(EventNotFoundError,),
    )


__all__ = [
    "EventAreaReferenceNotFoundError",
    "EventNotFoundError",
    "EventOccurrence",
    "EventTaskReferenceNotFoundError",
    "EventValidationError",
    "batch_delete_events",
    "create_event",
    "delete_event",
    "get_event",
    "list_event_occurrences",
    "list_events",
    "update_event",
]
