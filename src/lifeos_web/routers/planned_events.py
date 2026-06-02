"""Frontend-compatible planned event endpoints backed by LifeOS events."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import events as event_services
from lifeos_cli.db.services.event_support import (
    EventCreateInput,
    EventListInput,
    EventQueryFilters,
    EventUpdateInput,
)
from lifeos_cli.db.services.events import EventOccurrence
from lifeos_cli.db.services.read_models import EventView
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination, PlannedEventCreate, PlannedEventUpdate

router = APIRouter(prefix="/planned-events", tags=["planned-events"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


def _event_scope(value: str | None) -> str:
    if value in {"single", "all_future", "all"}:
        return value
    return "all"


def _parse_rrule(rrule_string: str | None) -> dict[str, object]:
    """Parse the subset of RRULE fields supported by LifeOS events."""
    if not rrule_string:
        return {}
    values: dict[str, object] = {}
    for part in rrule_string.split(";"):
        key, separator, value = part.partition("=")
        if not separator:
            continue
        normalized_key = key.strip().upper()
        normalized_value = value.strip()
        if normalized_key == "FREQ":
            values["frequency"] = normalized_value.lower()
        elif normalized_key == "INTERVAL":
            values["interval"] = int(normalized_value)
        elif normalized_key == "COUNT":
            values["count"] = int(normalized_value)
        elif normalized_key == "UNTIL":
            values["until"] = normalized_value
    return values


def _tag_names(event: EventView | EventOccurrence) -> list[str]:
    if not isinstance(event, EventView):
        return []
    return [tag.name for tag in event.tags]


def _people(event: EventView | EventOccurrence) -> list[dict[str, str]]:
    if not isinstance(event, EventView):
        return []
    return [{"id": str(person.id), "name": person.name} for person in event.people]


def _planned_event_payload(
    event: EventView | EventOccurrence,
    *,
    master_event: EventView | None = None,
) -> dict[str, object]:
    is_occurrence = isinstance(event, EventOccurrence)
    source = master_event if is_occurrence and master_event is not None else event
    recurrence_frequency = (
        None if isinstance(source, EventOccurrence) else source.recurrence_frequency
    )
    recurrence_pattern = (
        None
        if recurrence_frequency is None
        else {
            "frequency": recurrence_frequency,
            "interval": source.recurrence_interval,
            "count": source.recurrence_count,
            "until": source.recurrence_until.isoformat() if source.recurrence_until else None,
        }
    )
    master_id = source.id if is_occurrence else event.recurrence_parent_event_id or event.id
    created_at = "" if is_occurrence else event.created_at.isoformat()
    updated_at = "" if is_occurrence else event.updated_at.isoformat()
    area_id = None if isinstance(source, EventOccurrence) else source.area_id
    priority = 0 if isinstance(source, EventOccurrence) else source.priority
    is_all_day = False if isinstance(source, EventOccurrence) else source.is_all_day
    rrule_string = f"FREQ={recurrence_frequency.upper()}" if recurrence_frequency else None
    return {
        "id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat() if event.end_time else None,
        "priority": priority,
        "dimension_id": str(area_id) if area_id else None,
        "task_id": str(event.task_id) if event.task_id else None,
        "is_all_day": is_all_day,
        "is_recurring": recurrence_frequency is not None,
        "recurrence_pattern": recurrence_pattern,
        "rrule_string": rrule_string,
        "status": event.status,
        "tags": _tag_names(source),
        "extra_data": {"event_type": event.event_type},
        "created_at": created_at,
        "updated_at": updated_at,
        "is_instance": is_occurrence and recurrence_frequency is not None,
        "master_event_id": str(master_id) if master_id else None,
        "instance_id": str(event.id) if is_occurrence else None,
        "persons": _people(source),
    }


def _create_input(payload: PlannedEventCreate) -> EventCreateInput:
    recurrence = payload.recurrence_pattern or _parse_rrule(payload.rrule_string)
    has_recurrence_frequency = payload.is_recurring and recurrence.get("frequency")
    has_recurrence_interval = payload.is_recurring and recurrence.get("interval") is not None
    has_recurrence_count = payload.is_recurring and recurrence.get("count") is not None
    return EventCreateInput(
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        priority=payload.priority,
        status=payload.status,
        event_type="timeblock" if payload.task_id else "appointment",
        is_all_day=payload.is_all_day,
        area_id=payload.dimension_id,
        task_id=payload.task_id,
        person_ids=payload.person_ids,
        recurrence_frequency=str(recurrence.get("frequency")) if has_recurrence_frequency else None,
        recurrence_interval=int(recurrence["interval"]) if has_recurrence_interval else None,
        recurrence_count=int(recurrence["count"]) if has_recurrence_count else None,
        recurrence_until=(
            datetime.fromisoformat(str(recurrence["until"]))
            if payload.is_recurring and recurrence.get("until")
            else None
        ),
    )


def _update_input(payload: PlannedEventUpdate) -> EventUpdateInput:
    fields = payload.model_fields_set
    recurrence = payload.recurrence_pattern or _parse_rrule(payload.rrule_string)
    clear_recurrence = "is_recurring" in fields and payload.is_recurring is False
    return EventUpdateInput(
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        clear_end_time="end_time" in fields and payload.end_time is None,
        priority=payload.priority,
        status=payload.status,
        event_type="timeblock" if payload.task_id else None,
        is_all_day=payload.is_all_day,
        area_id=payload.dimension_id,
        clear_area="dimension_id" in fields and payload.dimension_id is None,
        task_id=payload.task_id,
        clear_task="task_id" in fields and payload.task_id is None,
        person_ids=payload.person_ids,
        clear_people="person_ids" in fields and payload.person_ids == [],
        recurrence_frequency=(
            str(recurrence.get("frequency"))
            if payload.is_recurring is not False and recurrence.get("frequency")
            else None
        ),
        recurrence_interval=(
            int(recurrence["interval"])
            if payload.is_recurring is not False and recurrence.get("interval") is not None
            else None
        ),
        recurrence_count=(
            int(recurrence["count"])
            if payload.is_recurring is not False and recurrence.get("count") is not None
            else None
        ),
        recurrence_until=(
            datetime.fromisoformat(str(recurrence["until"]))
            if payload.is_recurring is not False and recurrence.get("until")
            else None
        ),
        clear_recurrence=clear_recurrence,
    )


async def _list_events(
    session: AsyncSession,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    status: str | None = None,
    task_id: UUID | None = None,
    page: int = 1,
    size: int = 100,
) -> ListResponse:
    filters = EventQueryFilters(
        status=status,
        task_id=task_id,
        window_start=start,
        window_end=end,
    )
    rows = await event_services.list_events(
        session,
        query=EventListInput(filters=filters, limit=size, offset=(page - 1) * size),
    )
    items: list[dict[str, object]] = []
    for row in rows:
        if start is not None and end is not None:
            row_end = row.end_time or row.start_time
            if row.start_time >= end or row_end <= start:
                continue
        master_event = None
        if isinstance(row, EventOccurrence):
            master_event = await event_services.get_event(session, event_id=row.id)
        items.append(_planned_event_payload(row, master_event=master_event))
    return ListResponse(
        items=items,
        pagination=Pagination(
            page=page,
            size=size,
            total=len(items),
            pages=math.ceil(len(items) / size) if size else 0,
        ),
        meta={
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
            "status": status,
            "task_id": str(task_id) if task_id else None,
        },
    )


@router.get("/", response_model=ListResponse)
async def list_planned_events(
    session: SessionDep,
    start: datetime | None = None,
    end: datetime | None = None,
    status: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 100,
) -> ListResponse:
    """List expanded LifeOS events for a calendar window."""
    return await _list_events(session, start=start, end=end, status=status, page=page, size=size)


@router.get("/raw", response_model=ListResponse)
async def list_raw_planned_events(
    session: SessionDep,
    status: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 100,
) -> ListResponse:
    """List stored LifeOS event records without a required window."""
    return await _list_events(session, status=status, page=page, size=size)


@router.get("/by-task/{task_id}", response_model=ListResponse)
async def list_planned_events_by_task(
    task_id: UUID,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 100,
) -> ListResponse:
    """List events linked to a task."""
    return await _list_events(session, task_id=task_id, page=page, size=size)


@router.get("/{event_id}")
async def get_planned_event(event_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one LifeOS event as a planned event."""
    event = await event_services.get_event(session, event_id=event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Planned event {event_id} was not found")
    return _planned_event_payload(event)


@router.post("/")
async def create_planned_event(
    payload: PlannedEventCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create a LifeOS event through the frontend planned-event contract."""
    try:
        event = await event_services.create_event(session, payload=_create_input(payload))
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _planned_event_payload(event)


@router.patch("/{event_id}")
async def update_planned_event(
    event_id: UUID,
    payload: PlannedEventUpdate,
    session: SessionDep,
    updateType: str | None = None,
    instanceStart: datetime | None = None,
) -> dict[str, object]:
    """Update a LifeOS event through the frontend planned-event contract."""
    try:
        event = await event_services.update_event(
            session,
            event_id=event_id,
            changes=_update_input(payload),
            scope=_event_scope(updateType),
            instance_start=instanceStart,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _planned_event_payload(event)


@router.delete("/{event_id}", status_code=204)
async def delete_planned_event(
    event_id: UUID,
    session: SessionDep,
    deleteType: str | None = None,
    instanceStart: datetime | None = None,
) -> None:
    """Soft-delete a LifeOS event through the frontend planned-event contract."""
    try:
        await event_services.delete_event(
            session,
            event_id=event_id,
            scope=_event_scope(deleteType),
            instance_start=instanceStart,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
