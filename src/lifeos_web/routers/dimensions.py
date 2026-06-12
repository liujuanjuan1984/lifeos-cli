"""Frontend-compatible dimension endpoints backed by LifeOS areas."""

from __future__ import annotations

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area
from lifeos_cli.db.services import areas as area_services
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination

router = APIRouter(prefix="/dimensions", tags=["dimensions"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


class DimensionCreate(BaseModel):
    """Frontend-compatible dimension creation payload."""

    name: str
    description: str | None = None
    color: str = "#3B82F6"
    icon: str | None = None
    display_order: int = 0


class DimensionUpdate(BaseModel):
    """Frontend-compatible dimension update payload."""

    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


def _dimension_payload(area: Area) -> dict[str, object]:
    return {
        "id": str(area.id),
        "name": area.name,
        "description": area.description,
        "color": area.color,
        "icon": area.icon,
        "is_active": area.is_active,
        "display_order": area.display_order,
        "created_at": area.created_at.isoformat(),
        "updated_at": area.updated_at.isoformat(),
    }


@router.get("/", response_model=ListResponse)
async def list_dimensions(
    session: SessionDep,
    include_inactive: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=500)] = 100,
) -> ListResponse:
    """List LifeOS areas as frontend-compatible dimensions."""
    areas = await area_services.list_areas(
        session,
        include_inactive=include_inactive,
        limit=size,
        offset=(page - 1) * size,
    )
    items = [_dimension_payload(area) for area in areas]
    return ListResponse(
        items=items,
        pagination=Pagination(
            page=page,
            size=size,
            total=len(items),
            pages=math.ceil(len(items) / size) if size else 0,
        ),
        meta={"include_inactive": include_inactive},
    )


@router.get("/order")
async def get_dimension_order(session: SessionDep) -> list[str]:
    """Return current area display order as dimension ids."""
    areas = await area_services.list_areas(session, include_inactive=True, limit=500)
    return [str(area.id) for area in areas]


@router.put("/order", status_code=204)
async def set_dimension_order(order: list[UUID], session: SessionDep) -> None:
    """Persist area display order from the frontend dimension sorter."""
    for index, area_id in enumerate(order):
        try:
            await area_services.update_area(session, area_id=area_id, display_order=index)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/order", status_code=204)
async def reset_dimension_order(session: SessionDep) -> None:
    """Reset area display order to the current list order."""
    areas = await area_services.list_areas(session, include_inactive=True, limit=500)
    for index, area in enumerate(areas):
        await area_services.update_area(session, area_id=area.id, display_order=index)


@router.get("/{dimension_id}")
async def get_dimension(dimension_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one LifeOS area as a dimension."""
    area = await area_services.get_area(session, area_id=dimension_id, include_deleted=False)
    if area is None:
        raise HTTPException(status_code=404, detail=f"Dimension {dimension_id} was not found")
    return _dimension_payload(area)


@router.post("/")
async def create_dimension(payload: DimensionCreate, session: SessionDep) -> dict[str, object]:
    """Create a LifeOS area from the dimension manager."""
    try:
        area = await area_services.create_area(
            session,
            name=payload.name,
            description=payload.description,
            color=payload.color,
            icon=payload.icon,
            display_order=payload.display_order,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _dimension_payload(area)


@router.patch("/{dimension_id}")
async def update_dimension(
    dimension_id: UUID,
    payload: DimensionUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a LifeOS area through the dimension manager."""
    fields = payload.model_fields_set
    try:
        area = await area_services.update_area(
            session,
            area_id=dimension_id,
            name=payload.name,
            description=payload.description,
            clear_description="description" in fields and payload.description in {None, ""},
            color=payload.color,
            icon=payload.icon,
            clear_icon="icon" in fields and payload.icon in {None, ""},
            is_active=payload.is_active,
            display_order=payload.display_order,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _dimension_payload(area)


@router.delete("/{dimension_id}", status_code=204)
async def delete_dimension(dimension_id: UUID, session: SessionDep) -> None:
    """Soft-delete a LifeOS area."""
    try:
        await area_services.delete_area(session, area_id=dimension_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{dimension_id}/activate")
async def activate_dimension(dimension_id: UUID, session: SessionDep) -> dict[str, object]:
    """Reactivate an inactive LifeOS area."""
    try:
        area = await area_services.update_area(
            session,
            area_id=dimension_id,
            is_active=True,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _dimension_payload(area)
