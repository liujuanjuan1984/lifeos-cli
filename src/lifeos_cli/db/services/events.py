"""Async CRUD helpers for events."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.db.models.event import Event
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.entity_tags import load_tags_for_entities, sync_entity_tags
from lifeos_cli.db.services.event_support import (
    EventAreaReferenceNotFoundError,
    EventNotFoundError,
    EventTaskReferenceNotFoundError,
    EventValidationError,
    deduplicate_event_ids,
    ensure_event_area_exists,
    ensure_event_task_exists,
    validate_event_priority,
    validate_event_status,
    validate_event_time_range,
    validate_event_title,
)


async def _attach_event_links(session: AsyncSession, event: Event) -> Event:
    tags_map = await load_tags_for_entities(session, entity_ids=[event.id], entity_type="event")
    people_map = await load_people_for_entities(session, entity_ids=[event.id], entity_type="event")
    event.tags = tags_map.get(event.id, [])
    event.people = people_map.get(event.id, [])
    return event


async def _attach_event_links_for_many(session: AsyncSession, events: list[Event]) -> list[Event]:
    if not events:
        return []
    event_ids = [event.id for event in events]
    tags_map = await load_tags_for_entities(session, entity_ids=event_ids, entity_type="event")
    people_map = await load_people_for_entities(session, entity_ids=event_ids, entity_type="event")
    for event in events:
        event.tags = tags_map.get(event.id, [])
        event.people = people_map.get(event.id, [])
    return events


async def create_event(
    session: AsyncSession,
    *,
    title: str,
    start_time: datetime,
    end_time: datetime | None = None,
    description: str | None = None,
    priority: int = 0,
    status: str = "planned",
    is_all_day: bool = False,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    tag_ids: list[UUID] | None = None,
    person_ids: list[UUID] | None = None,
) -> Event:
    """Create a new event."""
    normalized_title = validate_event_title(title)
    validate_event_time_range(start_time=start_time, end_time=end_time)
    normalized_priority = validate_event_priority(priority)
    normalized_status = validate_event_status(status)
    await ensure_event_area_exists(session, area_id)
    await ensure_event_task_exists(session, task_id)
    event = Event(
        title=normalized_title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        priority=normalized_priority,
        status=normalized_status,
        is_all_day=is_all_day,
        area_id=area_id,
        task_id=task_id,
    )
    session.add(event)
    await session.flush()
    if tag_ids is not None:
        await sync_entity_tags(
            session, entity_id=event.id, entity_type="event", desired_tag_ids=tag_ids
        )
    if person_ids is not None:
        await sync_entity_people(
            session, entity_id=event.id, entity_type="event", desired_person_ids=person_ids
        )
    await session.refresh(event)
    return await _attach_event_links(session, event)


async def get_event(
    session: AsyncSession,
    *,
    event_id: UUID,
    include_deleted: bool = False,
) -> Event | None:
    """Load an event by identifier."""
    stmt = (
        select(Event)
        .options(selectinload(Event.area), selectinload(Event.task))
        .where(Event.id == event_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(Event.deleted_at.is_(None))
    event = (await session.execute(stmt)).scalar_one_or_none()
    if event is None:
        return None
    return await _attach_event_links(session, event)


async def list_events(
    session: AsyncSession,
    *,
    title_contains: str | None = None,
    status: str | None = None,
    area_id: UUID | None = None,
    task_id: UUID | None = None,
    person_id: UUID | None = None,
    tag_id: UUID | None = None,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Event]:
    """List events with optional filters."""
    stmt = select(Event).options(selectinload(Event.area), selectinload(Event.task))
    if not include_deleted:
        stmt = stmt.where(Event.deleted_at.is_(None))
    if title_contains:
        stmt = stmt.where(Event.title.ilike(f"%{title_contains.strip()}%"))
    if status is not None:
        stmt = stmt.where(Event.status == validate_event_status(status))
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
    if window_start is not None and window_end is not None:
        stmt = stmt.where(Event.start_time <= window_end).where(
            or_(Event.end_time.is_(None), Event.end_time >= window_start)
        )
    elif window_start is not None:
        stmt = stmt.where(or_(Event.end_time.is_(None), Event.end_time >= window_start))
    elif window_end is not None:
        stmt = stmt.where(Event.start_time <= window_end)
    stmt = stmt.order_by(Event.start_time.desc(), Event.id.desc()).offset(offset).limit(limit)
    events = list((await session.execute(stmt)).scalars())
    return await _attach_event_links_for_many(session, events)


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
    is_all_day: bool | None = None,
    area_id: UUID | None = None,
    clear_area: bool = False,
    task_id: UUID | None = None,
    clear_task: bool = False,
    tag_ids: list[UUID] | None = None,
    clear_tags: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> Event:
    """Update one event."""
    event = await get_event(session, event_id=event_id, include_deleted=False)
    if event is None:
        raise EventNotFoundError(f"Event {event_id} was not found")

    next_start_time = start_time if start_time is not None else event.start_time
    next_end_time = None if clear_end_time else end_time if end_time is not None else event.end_time
    validate_event_time_range(start_time=next_start_time, end_time=next_end_time)

    if title is not None:
        event.title = validate_event_title(title)
    if clear_description:
        event.description = None
    elif description is not None:
        event.description = description
    if start_time is not None:
        event.start_time = start_time
    if clear_end_time:
        event.end_time = None
    elif end_time is not None:
        event.end_time = end_time
    if priority is not None:
        event.priority = validate_event_priority(priority)
    if status is not None:
        event.status = validate_event_status(status)
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
    if clear_tags:
        await sync_entity_tags(session, entity_id=event.id, entity_type="event", desired_tag_ids=[])
    elif tag_ids is not None:
        await sync_entity_tags(
            session, entity_id=event.id, entity_type="event", desired_tag_ids=tag_ids
        )
    if clear_people:
        await sync_entity_people(
            session, entity_id=event.id, entity_type="event", desired_person_ids=[]
        )
    elif person_ids is not None:
        await sync_entity_people(
            session, entity_id=event.id, entity_type="event", desired_person_ids=person_ids
        )
    await session.flush()
    await session.refresh(event)
    return await _attach_event_links(session, event)


async def delete_event(session: AsyncSession, *, event_id: UUID) -> None:
    """Soft-delete one event."""
    event = await get_event(session, event_id=event_id, include_deleted=False)
    if event is None:
        raise EventNotFoundError(f"Event {event_id} was not found")
    event.soft_delete()
    await session.flush()


async def batch_delete_events(
    session: AsyncSession,
    *,
    event_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple events."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []
    for event_id in deduplicate_event_ids(event_ids):
        try:
            await delete_event(session, event_id=event_id)
            deleted_count += 1
        except EventNotFoundError as exc:
            failed_ids.append(event_id)
            errors.append(str(exc))
    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )


__all__ = [
    "EventAreaReferenceNotFoundError",
    "EventNotFoundError",
    "EventTaskReferenceNotFoundError",
    "EventValidationError",
    "batch_delete_events",
    "create_event",
    "delete_event",
    "get_event",
    "list_events",
    "update_event",
]
