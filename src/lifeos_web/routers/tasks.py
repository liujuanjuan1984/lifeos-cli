"""Task endpoints used by the local planning UI."""

from __future__ import annotations

import math
from datetime import date
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import tasks as task_services
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination, TaskCreate, TaskStatusUpdate, TaskUpdate
from lifeos_web.serialization import to_jsonable

router = APIRouter(prefix="/tasks", tags=["tasks"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


def _page_envelope(
    *,
    items: list[dict[str, object]],
    page: int,
    size: int,
    meta: dict[str, object],
) -> ListResponse:
    total = len(items)
    pages = math.ceil(total / size) if size > 0 else 0
    return ListResponse(
        items=items,
        pagination=Pagination(page=page, size=size, total=total, pages=pages),
        meta=meta,
    )


def _task_tree_payload(task: Any) -> dict[str, object]:
    """Serialize a nested task read model without leaking SQLAlchemy internals."""
    return {
        "id": str(task.id),
        "vision_id": str(task.vision_id),
        "parent_task_id": str(task.parent_task_id) if task.parent_task_id else None,
        "content": task.content,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "display_order": task.display_order,
        "estimated_effort": task.estimated_effort,
        "planning_cycle_type": task.planning_cycle_type,
        "planning_cycle_days": task.planning_cycle_days,
        "planning_cycle_start_date": (
            task.planning_cycle_start_date.isoformat() if task.planning_cycle_start_date else None
        ),
        "actual_effort": task.actual_effort_total,
        "actual_effort_self": task.actual_effort_self,
        "actual_effort_total": task.actual_effort_total,
        "notes_count": 0,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "deleted_at": task.deleted_at.isoformat() if task.deleted_at else None,
        "persons": to_jsonable(task.people),
        "subtasks": [_task_tree_payload(subtask) for subtask in task.subtasks],
        "completion_percentage": task.completion_percentage,
        "depth": task.depth,
    }


@router.get("/", response_model=ListResponse)
async def list_tasks(
    session: SessionDep,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
    vision_id: UUID | None = None,
    vision_in: str | None = None,
    status_filter: str | None = None,
    status_in: str | None = None,
    exclude_status: str | None = None,
    planning_cycle_type: str | None = None,
    planning_cycle_start_date: date | None = None,
    fields: str = "basic",
) -> ListResponse:
    """List tasks using the frontend planning query shape."""
    del fields
    try:
        rows = await task_services.list_tasks(
            session,
            vision_id=vision_id,
            vision_in=vision_in,
            status=status_filter,
            status_in=status_in,
            exclude_status=exclude_status,
            planning_cycle_type=planning_cycle_type,
            planning_cycle_start_date=planning_cycle_start_date,
            limit=size,
            offset=(page - 1) * size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _page_envelope(
        items=[to_jsonable(row) for row in rows],
        page=page,
        size=size,
        meta={
            "vision_id": str(vision_id) if vision_id else None,
            "vision_in": vision_in,
            "status_filter": status_filter,
            "status_in": status_in,
            "exclude_status": exclude_status,
            "planning_cycle_type": planning_cycle_type,
            "planning_cycle_start_date": (
                planning_cycle_start_date.isoformat() if planning_cycle_start_date else None
            ),
        },
    )


@router.get("/{task_id}")
async def get_task(task_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one task."""
    task = await task_services.get_task(session, task_id=task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} was not found")
    return to_jsonable(task)


@router.post("/")
async def create_task(
    payload: TaskCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create a task."""
    try:
        task = await task_services.create_task(
            session,
            vision_id=payload.vision_id,
            parent_task_id=payload.parent_task_id,
            content=payload.content,
            priority=payload.priority,
            display_order=payload.display_order,
            estimated_effort=payload.estimated_effort,
            planning_cycle_type=payload.planning_cycle_type,
            planning_cycle_days=payload.planning_cycle_days,
            planning_cycle_start_date=payload.planning_cycle_start_date,
        )
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable(task)


@router.put("/{task_id}")
async def replace_task(
    task_id: UUID,
    payload: TaskUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Frontend-compatible alias for partial task update."""
    return await update_task(task_id=task_id, payload=payload, session=session)


@router.patch("/{task_id}")
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a task."""
    fields = payload.model_fields_set
    clear_planning_cycle = "planning_cycle_type" in fields and payload.planning_cycle_type is None
    clear_parent = "parent_task_id" in fields and payload.parent_task_id is None
    clear_estimated_effort = "estimated_effort" in fields and payload.estimated_effort is None
    try:
        task = await task_services.update_task(
            session,
            task_id=task_id,
            content=payload.content,
            status=payload.status,
            priority=payload.priority,
            display_order=payload.display_order,
            estimated_effort=payload.estimated_effort,
            parent_task_id=payload.parent_task_id,
            planning_cycle_type=payload.planning_cycle_type,
            planning_cycle_days=payload.planning_cycle_days,
            planning_cycle_start_date=payload.planning_cycle_start_date,
            clear_planning_cycle=clear_planning_cycle,
            clear_parent=clear_parent,
            clear_estimated_effort=clear_estimated_effort,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: UUID, session: SessionDep) -> None:
    """Soft-delete one task."""
    try:
        await task_services.delete_task(session, task_id=task_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: UUID,
    payload: TaskStatusUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a task status."""
    try:
        task = await task_services.update_task(
            session,
            task_id=task_id,
            status=payload.status,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_jsonable(task)


@router.get("/vision/{vision_id}/hierarchy")
async def get_vision_hierarchy(vision_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load a frontend-compatible task hierarchy for one vision."""
    try:
        hierarchy = await task_services.get_vision_task_hierarchy(session, vision_id=vision_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "vision_id": str(hierarchy.vision_id),
        "root_tasks": [_task_tree_payload(task) for task in hierarchy.root_tasks],
    }


@router.get("/{task_id}/with-subtasks")
async def get_task_with_subtasks(task_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one task with nested subtasks."""
    task = await task_services.get_task_with_subtasks(session, task_id=task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} was not found")
    return _task_tree_payload(task)


@router.get("/{task_id}/stats")
async def get_task_stats(task_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load task subtree stats."""
    try:
        stats = await task_services.get_task_stats(session, task_id=task_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return to_jsonable(stats)


@router.post("/reorder", status_code=204)
async def reorder_tasks(payload: dict[str, Any], session: SessionDep) -> None:
    """Update display order for multiple tasks."""
    task_orders = [
        (UUID(str(item["id"])), int(item["display_order"]))
        for item in payload.get("task_orders", [])
    ]
    try:
        await task_services.reorder_tasks(session, task_orders=task_orders)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{task_id}/move")
async def move_task(
    task_id: UUID,
    payload: dict[str, Any],
    session: SessionDep,
) -> dict[str, object]:
    """Move a task to a new parent/vision."""
    try:
        result = await task_services.move_task(
            session,
            task_id=task_id,
            old_parent_task_id=(
                UUID(str(payload["old_parent_task_id"]))
                if payload.get("old_parent_task_id")
                else None
            ),
            new_parent_task_id=(
                UUID(str(payload["new_parent_task_id"]))
                if payload.get("new_parent_task_id")
                else None
            ),
            new_vision_id=(
                UUID(str(payload["new_vision_id"])) if payload.get("new_vision_id") else None
            ),
            new_display_order=payload.get("new_display_order"),
        )
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        **to_jsonable(await task_services.get_task(session, task_id=result.task.id)),
        "updated_descendants": [to_jsonable(task) for task in result.updated_descendants],
    }
