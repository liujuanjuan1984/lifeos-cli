"""Person endpoints used by the local LifeOS Web UI."""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.association import Association
from lifeos_cli.db.models.event import Event
from lifeos_cli.db.models.note import Note
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.models.timelog import Timelog
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services import people as people_services
from lifeos_cli.db.services.read_models import PersonView, TagSummaryView
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination

router = APIRouter(prefix="/persons", tags=["persons"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


class PersonCreate(BaseModel):
    """Frontend-compatible person creation payload."""

    name: str
    description: str | None = None
    nicknames: list[str] | None = None
    birth_date: date | None = None
    location: str | None = None
    tag_ids: list[UUID] | None = None


class PersonUpdate(BaseModel):
    """Frontend-compatible person update payload."""

    name: str | None = None
    description: str | None = None
    nicknames: list[str] | None = None
    birth_date: date | None = None
    location: str | None = None
    tag_ids: list[UUID] | None = None


def _tag_payload(tag: TagSummaryView) -> dict[str, object]:
    return {
        "id": str(tag.id),
        "name": tag.name,
        "entity_type": "person",
        "category": "general",
        "description": None,
        "color": None,
        "created_at": "",
        "updated_at": "",
    }


def _person_payload(person: PersonView) -> dict[str, object]:
    nicknames = list(person.nicknames)
    primary_nickname = nicknames[0] if nicknames else person.name
    tags = [_tag_payload(tag) for tag in person.tags]
    return {
        "id": str(person.id),
        "name": person.name,
        "description": person.description,
        "nicknames": nicknames,
        "birth_date": person.birth_date.isoformat() if person.birth_date else None,
        "location": person.location,
        "tags": tags,
        "anniversaries": [],
        "display_name": person.name,
        "primary_nickname": primary_nickname,
    }


def _preview(value: str | None, *, limit: int = 160) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 1]}..."


def _activity_payload(
    *,
    entity_id: UUID,
    activity_type: str,
    title: str,
    description: str | None,
    activity_date: date | datetime,
    status: str | None = None,
) -> dict[str, object]:
    return {
        "id": str(entity_id),
        "type": activity_type,
        "title": title,
        "description": _preview(description),
        "date": activity_date.isoformat(),
        "status": status,
    }


async def _load_person_entity_ids(
    session: AsyncSession,
    *,
    person_id: UUID,
) -> dict[str, list[UUID]]:
    rows = await session.execute(
        select(
            person_associations.c.entity_type,
            person_associations.c.entity_id,
        ).where(person_associations.c.person_id == person_id)
    )
    grouped: dict[str, list[UUID]] = {}
    for entity_type, entity_id in rows.all():
        grouped.setdefault(str(entity_type), []).append(entity_id)
    return grouped


async def _load_person_note_ids(session: AsyncSession, *, person_id: UUID) -> list[UUID]:
    rows = await session.execute(
        select(Association.source_id).where(
            Association.source_model == "note",
            Association.target_model == "person",
            Association.target_id == person_id,
        )
    )
    return list(rows.scalars().all())


async def _load_activity_items(
    session: AsyncSession,
    *,
    person_id: UUID,
    activity_filter: str | None,
) -> list[dict[str, object]]:
    entity_ids = await _load_person_entity_ids(session, person_id=person_id)
    items: list[dict[str, object]] = []

    if activity_filter in (None, "vision"):
        vision_ids = entity_ids.get("vision", [])
        if vision_ids:
            vision_rows = await session.execute(
                select(Vision).where(Vision.id.in_(vision_ids), Vision.deleted_at.is_(None))
            )
            items.extend(
                _activity_payload(
                    entity_id=vision.id,
                    activity_type="vision",
                    title=vision.name,
                    description=vision.description,
                    activity_date=vision.updated_at,
                    status=vision.status,
                )
                for vision in vision_rows.scalars()
            )

    if activity_filter in (None, "task"):
        task_ids = entity_ids.get("task", [])
        if task_ids:
            task_rows = await session.execute(
                select(Task).where(Task.id.in_(task_ids), Task.deleted_at.is_(None))
            )
            items.extend(
                _activity_payload(
                    entity_id=task.id,
                    activity_type="task",
                    title=task.content,
                    description=task.description,
                    activity_date=task.updated_at,
                    status=task.status,
                )
                for task in task_rows.scalars()
            )

    if activity_filter in (None, "planned_event"):
        planned_event_ids = entity_ids.get("event", [])
        if planned_event_ids:
            planned_event_rows = await session.execute(
                select(Event).where(Event.id.in_(planned_event_ids), Event.deleted_at.is_(None))
            )
            items.extend(
                _activity_payload(
                    entity_id=planned_event_record.id,
                    activity_type="planned_event",
                    title=planned_event_record.title,
                    description=planned_event_record.description,
                    activity_date=planned_event_record.start_time,
                    status=planned_event_record.status,
                )
                for planned_event_record in planned_event_rows.scalars()
            )

    if activity_filter in (None, "timelog"):
        timelog_ids = entity_ids.get("timelog", [])
        if timelog_ids:
            timelog_rows = await session.execute(
                select(Timelog).where(Timelog.id.in_(timelog_ids), Timelog.deleted_at.is_(None))
            )
            items.extend(
                _activity_payload(
                    entity_id=timelog.id,
                    activity_type="timelog",
                    title=timelog.title,
                    description=timelog.notes,
                    activity_date=timelog.start_time,
                    status=timelog.tracking_method,
                )
                for timelog in timelog_rows.scalars()
            )

    if activity_filter in (None, "note"):
        note_ids = await _load_person_note_ids(session, person_id=person_id)
        if note_ids:
            note_rows = await session.execute(
                select(Note).where(Note.id.in_(note_ids), Note.deleted_at.is_(None))
            )
            items.extend(
                _activity_payload(
                    entity_id=note.id,
                    activity_type="note",
                    title=_preview(note.content, limit=80) or "Note",
                    description=note.content,
                    activity_date=note.updated_at,
                )
                for note in note_rows.scalars()
            )

    return sorted(items, key=lambda item: str(item["date"]), reverse=True)


@router.get("/", response_model=ListResponse)
async def list_persons(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 100,
    search: str | None = None,
    tag_id: UUID | None = None,
    tag_filter: str | None = None,
) -> ListResponse:
    """List people for frontend person selectors and pages."""
    del tag_filter
    people = await people_services.list_people(
        session,
        search=search,
        tag_id=tag_id,
        limit=size,
        offset=(page - 1) * size,
    )
    items = [_person_payload(person) for person in people]
    return ListResponse(
        items=items,
        pagination=Pagination(page=page, size=size, total=len(items), pages=1 if items else 0),
        meta={"search": search, "tag_filter": None, "tag_id": str(tag_id) if tag_id else None},
    )


@router.get("/search-by-tag", response_model=ListResponse)
async def search_persons_by_tag(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 50,
) -> ListResponse:
    """Return an empty tag-name search result until LifeOS supports tag-name lookup."""
    del session
    return ListResponse(
        items=[],
        pagination=Pagination(page=page, size=size, total=0, pages=0),
        meta={"search": None, "tag_filter": None, "tag_id": None},
    )


@router.get("/{person_id}")
async def get_person(person_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one person."""
    person = await people_services.get_person(session, person_id=person_id)
    if person is None:
        raise HTTPException(status_code=404, detail=f"Person {person_id} was not found")
    return _person_payload(person)


@router.post("/")
async def create_person(payload: PersonCreate, session: SessionDep) -> dict[str, object]:
    """Create a person."""
    try:
        person = await people_services.create_person(
            session,
            name=payload.name,
            description=payload.description,
            nicknames=payload.nicknames,
            birth_date=payload.birth_date,
            location=payload.location,
            tag_ids=payload.tag_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _person_payload(person)


@router.patch("/{person_id}")
async def update_person(
    person_id: UUID,
    payload: PersonUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a person."""
    provided_fields = payload.model_fields_set
    try:
        person = await people_services.update_person(
            session,
            person_id=person_id,
            name=payload.name,
            description=payload.description,
            clear_description="description" in provided_fields and payload.description == "",
            nicknames=payload.nicknames,
            clear_nicknames="nicknames" in provided_fields and payload.nicknames == [],
            birth_date=payload.birth_date,
            clear_birth_date="birth_date" in provided_fields and payload.birth_date is None,
            location=payload.location,
            clear_location="location" in provided_fields and payload.location == "",
            tag_ids=payload.tag_ids,
            clear_tags="tag_ids" in provided_fields and payload.tag_ids == [],
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _person_payload(person)


@router.delete("/{person_id}", status_code=204)
async def delete_person(person_id: UUID, session: SessionDep) -> None:
    """Soft-delete a person."""
    try:
        await people_services.delete_person(session, person_id=person_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{person_id}/activities/", response_model=ListResponse)
async def list_person_activities(
    person_id: UUID,
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 50,
    activity_type: str | None = None,
    type: str | None = None,
) -> ListResponse:
    """Return person-linked activity timeline data."""
    person = await people_services.get_person(session, person_id=person_id)
    if person is None:
        raise HTTPException(status_code=404, detail=f"Person {person_id} was not found")
    activity_filter = activity_type or type
    if activity_filter == "all":
        activity_filter = None
    if activity_filter not in {None, "vision", "task", "planned_event", "timelog", "note"}:
        raise HTTPException(status_code=400, detail=f"Unsupported activity type: {activity_filter}")

    all_items = await _load_activity_items(
        session,
        person_id=person_id,
        activity_filter=activity_filter,
    )
    start = (page - 1) * size
    items = all_items[start : start + size]
    total = len(all_items)
    return ListResponse(
        items=items,
        pagination=Pagination(
            page=page,
            size=size,
            total=total,
            pages=math.ceil(total / size) if size else 0,
        ),
        meta={
            "person_id": str(person_id),
            "person_name": person.name,
            "activity_type": activity_filter,
        },
    )


@router.get("/{person_id}/anniversaries/", response_model=ListResponse)
async def list_person_anniversaries(
    person_id: UUID,
    session: SessionDep,
) -> ListResponse:
    """Return empty anniversaries until LifeOS has an anniversary model."""
    person = await people_services.get_person(session, person_id=person_id)
    if person is None:
        raise HTTPException(status_code=404, detail=f"Person {person_id} was not found")
    return ListResponse(
        items=[],
        pagination=Pagination(page=1, size=100, total=0, pages=0),
        meta={"person_id": str(person_id)},
    )
