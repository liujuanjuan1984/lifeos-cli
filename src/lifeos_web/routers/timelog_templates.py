"""Timelog quick template endpoints for the local Web UI."""

from __future__ import annotations

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import timelog_templates as template_services
from lifeos_cli.db.services.read_models import PersonSummaryView, TimelogTemplateView
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import (
    ListResponse,
    Pagination,
    TimelogTemplateBulkCreateRequest,
    TimelogTemplateCreate,
    TimelogTemplateReorderRequest,
    TimelogTemplateUpdate,
)
from lifeos_web.serialization import to_jsonable

router = APIRouter(prefix="/timelogs/templates", tags=["timelog-templates"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


def _person_payload(person: PersonSummaryView) -> dict[str, object]:
    return {
        "id": str(person.id),
        "name": person.name,
        "display_name": person.name,
        "primary_nickname": person.name,
        "tags": [],
    }


def _template_payload(template: TimelogTemplateView) -> dict[str, object]:
    payload = to_jsonable(template)
    if not isinstance(payload, dict):
        raise TypeError("Timelog template serialization did not produce a dictionary.")
    payload["person_ids"] = [str(person_id) for person_id in template.person_ids]
    payload["people"] = [_person_payload(person) for person in template.people]
    return payload


def _update_input(payload: TimelogTemplateUpdate) -> template_services.TimelogTemplateUpdateInput:
    fields = payload.model_fields_set
    return template_services.TimelogTemplateUpdateInput(
        title=payload.title,
        title_provided="title" in fields,
        area_id=payload.area_id,
        area_provided="area_id" in fields,
        person_ids=payload.person_ids,
        person_ids_provided="person_ids" in fields,
        default_duration_minutes=payload.default_duration_minutes,
        default_duration_minutes_provided="default_duration_minutes" in fields,
        position=payload.position,
        position_provided="position" in fields,
        usage_count=payload.usage_count,
        usage_count_provided="usage_count" in fields,
        last_used_at=payload.last_used_at,
        last_used_at_provided="last_used_at" in fields,
    )


@router.get("/", response_model=ListResponse)
async def list_timelog_templates(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 50,
    order_by: Annotated[str, Query(pattern="^(position|usage|recent)$")] = "position",
) -> ListResponse:
    """List timelog quick templates for the Web UI."""
    total_count = await template_services.count_templates(session)
    rows = await template_services.list_templates(
        session,
        query=template_services.TimelogTemplateListInput(
            limit=size,
            offset=(page - 1) * size,
            order_by=order_by,
        ),
    )
    return ListResponse(
        items=[_template_payload(row) for row in rows],
        pagination=Pagination(
            page=page,
            size=size,
            total=total_count,
            pages=math.ceil(total_count / size) if size else 0,
        ),
        meta={"order_by": order_by},
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_timelog_template(
    payload: TimelogTemplateCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create a timelog quick template."""
    try:
        template = await template_services.create_template(
            session,
            payload=template_services.TimelogTemplateCreateInput(
                title=payload.title,
                area_id=payload.area_id,
                person_ids=payload.person_ids,
                default_duration_minutes=payload.default_duration_minutes,
                position=payload.position,
                usage_count=payload.usage_count,
                last_used_at=payload.last_used_at,
            ),
        )
    except template_services.TimelogTemplateAlreadyExistsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _template_payload(template)


@router.post("/bulk", status_code=status.HTTP_201_CREATED, response_model=ListResponse)
async def bulk_create_timelog_templates(
    payload: TimelogTemplateBulkCreateRequest,
    session: SessionDep,
) -> ListResponse:
    """Create multiple timelog templates, skipping duplicate titles."""
    created: list[dict[str, object]] = []
    for item in payload.items:
        try:
            template = await template_services.create_template(
                session,
                payload=template_services.TimelogTemplateCreateInput(
                    title=item.title,
                    area_id=item.area_id,
                    person_ids=item.person_ids,
                    default_duration_minutes=item.default_duration_minutes,
                    position=item.position,
                    usage_count=item.usage_count,
                    last_used_at=item.last_used_at,
                ),
            )
        except template_services.TimelogTemplateAlreadyExistsError:
            continue
        except (LookupError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        created.append(_template_payload(template))
    total = len(created)
    return ListResponse(
        items=created,
        pagination=Pagination(page=1, size=total, total=total, pages=1 if total else 0),
        meta={"order_by": None},
    )


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_timelog_templates(
    payload: TimelogTemplateReorderRequest,
    session: SessionDep,
) -> None:
    """Update timelog template display positions."""
    try:
        await template_services.reorder_templates(
            session,
            positions=[(item.id, item.position) for item in payload.items],
        )
    except template_services.TimelogTemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{template_id}")
async def update_timelog_template(
    template_id: UUID,
    payload: TimelogTemplateUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a timelog quick template."""
    try:
        template = await template_services.update_template(
            session,
            template_id=template_id,
            changes=_update_input(payload),
        )
    except template_services.TimelogTemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except template_services.TimelogTemplateAlreadyExistsError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _template_payload(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_timelog_template(template_id: UUID, session: SessionDep) -> None:
    """Soft-delete a timelog quick template."""
    try:
        await template_services.delete_template(session, template_id=template_id)
    except template_services.TimelogTemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{template_id}/bump-usage")
async def bump_timelog_template_usage(
    template_id: UUID,
    session: SessionDep,
) -> dict[str, object]:
    """Increment usage metadata for one timelog quick template."""
    try:
        template = await template_services.bump_template_usage(
            session,
            template_id=template_id,
        )
    except template_services.TimelogTemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _template_payload(template)
