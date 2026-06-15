"""Note endpoints for the local Web UI."""

from __future__ import annotations

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import notes as note_services
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, NoteCreate, NoteUpdate, Pagination
from lifeos_web.serialization import to_jsonable, to_jsonable_dict

router = APIRouter(prefix="/notes", tags=["notes"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


@router.get("/", response_model=ListResponse)
async def list_notes(
    session: SessionDep,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    keyword: str | None = None,
    tag_id: UUID | None = None,
    person_id: UUID | None = None,
    task_id: UUID | None = None,
    timelog_id: UUID | None = None,
) -> ListResponse:
    """List notes for the local Web UI."""
    offset = (page - 1) * size
    rows = (
        await note_services.search_notes(
            session,
            query=keyword,
            tag_id=tag_id,
            person_id=person_id,
            task_id=task_id,
            timelog_id=timelog_id,
            limit=size,
            offset=offset,
        )
        if keyword
        else await note_services.list_notes(
            session,
            tag_id=tag_id,
            person_id=person_id,
            task_id=task_id,
            timelog_id=timelog_id,
            limit=size,
            offset=offset,
        )
    )
    items = [to_jsonable(row) for row in rows]
    return ListResponse(
        items=items,
        pagination=Pagination(
            page=page,
            size=size,
            total=len(items),
            pages=math.ceil(len(items) / size) if size else 0,
        ),
        meta={
            "keyword": keyword,
            "tag_id": str(tag_id) if tag_id else None,
            "person_id": str(person_id) if person_id else None,
            "task_id": str(task_id) if task_id else None,
            "timelog_id": str(timelog_id) if timelog_id else None,
        },
    )


@router.post("/")
async def create_note(
    payload: NoteCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create a note."""
    try:
        note = await note_services.create_note(
            session,
            content=payload.content,
            tag_ids=payload.tag_ids,
            person_ids=payload.person_ids,
            task_ids=[payload.task_id] if payload.task_id is not None else None,
            timelog_ids=payload.timelog_ids,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable_dict(note)


@router.patch("/{note_id}")
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a note."""
    try:
        fields = payload.model_fields_set
        note = await note_services.update_note(
            session,
            note_id=note_id,
            content=payload.content,
            tag_ids=payload.tag_ids,
            clear_tags="tag_ids" in fields and payload.tag_ids == [],
            person_ids=payload.person_ids,
            clear_people="person_ids" in fields and payload.person_ids == [],
            task_ids=[payload.task_id] if payload.task_id is not None else None,
            clear_tasks="task_id" in fields and payload.task_id is None,
            timelog_ids=payload.timelog_ids,
            clear_timelogs=("timelog_ids" in fields and payload.timelog_ids == []),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable_dict(note)


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: UUID,
    session: SessionDep,
) -> None:
    """Soft-delete a note."""
    try:
        await note_services.delete_note(session, note_id=note_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
