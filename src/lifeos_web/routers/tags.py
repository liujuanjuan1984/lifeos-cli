"""Tag endpoints for the local Web UI."""

from __future__ import annotations

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import tags as tag_services
from lifeos_cli.db.services.tags import VALID_TAG_ENTITY_TYPES
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination, TagCreate, TagUpdate
from lifeos_web.serialization import to_jsonable

router = APIRouter(prefix="/tags", tags=["tags"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


@router.get("/", response_model=ListResponse)
async def list_tags(
    session: SessionDep,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=1000),
    entity_type: str | None = None,
    category: str | None = None,
) -> ListResponse:
    """List LifeOS tags for selectors and tag management."""
    offset = (page - 1) * size
    try:
        rows = await tag_services.list_tags(
            session,
            entity_type=entity_type,
            category=category,
            limit=size,
            offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = [to_jsonable(row) for row in rows]
    return ListResponse(
        items=items,
        pagination=Pagination(
            page=page,
            size=size,
            total=len(items),
            pages=math.ceil(len(items) / size) if size else 0,
        ),
        meta={"entity_type": entity_type, "category": category},
    )


@router.get("/entity-types/")
async def list_tag_entity_types() -> list[str]:
    """Return supported LifeOS tag entity types."""
    return sorted(VALID_TAG_ENTITY_TYPES)


@router.get("/categories/")
async def list_tag_categories(entity_type: str | None = None) -> list[dict[str, object]]:
    """Return the default category option used by LifeOS tags."""
    del entity_type
    return [{"value": "general", "label": "General", "entity_type": None}]


@router.post("/")
async def create_tag(payload: TagCreate, session: SessionDep) -> dict[str, object]:
    """Create a LifeOS tag."""
    try:
        tag = await tag_services.create_tag(
            session,
            name=payload.name,
            entity_type=payload.entity_type,
            category=payload.category,
            description=payload.description,
            color=payload.color,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable(tag)


@router.get("/{tag_id}")
async def get_tag(tag_id: UUID, session: SessionDep) -> dict[str, object]:
    """Return one LifeOS tag."""
    tag = await tag_services.get_tag(session, tag_id=tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail=f"Tag {tag_id} was not found")
    return to_jsonable(tag)


@router.patch("/{tag_id}")
async def update_tag(
    tag_id: UUID,
    payload: TagUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update one LifeOS tag."""
    fields = payload.model_fields_set
    try:
        tag = await tag_services.update_tag(
            session,
            tag_id=tag_id,
            name=payload.name,
            entity_type=payload.entity_type,
            category=payload.category,
            description=payload.description,
            clear_description="description" in fields and payload.description is None,
            color=payload.color,
            clear_color="color" in fields and payload.color is None,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable(tag)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: UUID, session: SessionDep) -> None:
    """Soft-delete a LifeOS tag."""
    try:
        await tag_services.delete_tag(session, tag_id=tag_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
