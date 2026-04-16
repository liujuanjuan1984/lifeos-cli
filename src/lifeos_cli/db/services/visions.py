"""Async CRUD helpers for visions."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.config import (
    MAX_VISION_EXPERIENCE_RATE_PER_HOUR,
    ConfigurationError,
    get_preferences_settings,
    validate_vision_experience_rate_per_hour,
)
from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services.batching import BatchDeleteResult, batch_delete_records
from lifeos_cli.db.services.collection_utils import deduplicate_preserving_order
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.model_utils import (
    load_model_by_id,
    load_view_by_id,
    soft_delete_model_by_id,
)
from lifeos_cli.db.services.read_models import VisionView, build_vision_view

VALID_VISION_STATUSES = {"active", "archived", "fruit"}
VISION_EXPERIENCE_RATE_MAX = MAX_VISION_EXPERIENCE_RATE_PER_HOUR


@dataclass(frozen=True)
class VisionStats:
    """Aggregated task statistics for a vision."""

    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    todo_tasks: int
    completion_percentage: float
    total_estimated_effort: int | None
    total_actual_effort: int | None


class VisionNotFoundError(LookupError):
    """Raised when a vision cannot be found."""


class VisionAlreadyExistsError(ValueError):
    """Raised when a vision with the same name already exists."""


class AreaReferenceNotFoundError(LookupError):
    """Raised when a referenced area cannot be found."""


class VisionNotReadyForHarvestError(ValueError):
    """Raised when a vision cannot be harvested yet."""


def validate_vision_status(status: str) -> str:
    """Validate a vision status."""
    normalized = status.strip().lower()
    if normalized not in VALID_VISION_STATUSES:
        allowed = ", ".join(sorted(VALID_VISION_STATUSES))
        raise ValueError(f"Invalid vision status {normalized!r}. Expected one of: {allowed}")
    return normalized


def validate_vision_experience_rate(experience_rate_per_hour: int | None) -> int | None:
    """Validate a vision-specific experience rate override."""
    if experience_rate_per_hour is None:
        return None
    try:
        return validate_vision_experience_rate_per_hour(experience_rate_per_hour)
    except ConfigurationError as exc:
        raise ValueError(
            f"Experience rate per hour must be between 1 and {VISION_EXPERIENCE_RATE_MAX}"
        ) from exc


def validate_experience_points(points: int) -> int:
    """Validate manual experience additions."""
    if points < 0:
        raise ValueError("Experience points must be greater than or equal to zero")
    return points


def resolve_experience_rate_for_vision(vision: Vision) -> int:
    """Return the effective experience rate for a vision."""
    return (
        validate_vision_experience_rate(vision.experience_rate_per_hour)
        or get_preferences_settings().vision_experience_rate_per_hour
    )


def _apply_effective_experience_rate(vision: Vision, effective_rate: int) -> None:
    if vision.experience_rate_per_hour is None:
        vision.experience_rate_per_hour = effective_rate


async def _ensure_area_exists(session: AsyncSession, area_id: UUID | None) -> None:
    if area_id is None:
        return
    area = await session.execute(
        select(Area.id).where(Area.id == area_id, Area.deleted_at.is_(None)).limit(1)
    )
    if area.scalar_one_or_none() is None:
        raise AreaReferenceNotFoundError(f"Area {area_id} was not found")


async def _load_active_tasks_for_vision(session: AsyncSession, vision_id: UUID) -> list[Task]:
    stmt = (
        select(Task)
        .where(Task.vision_id == vision_id, Task.deleted_at.is_(None))
        .order_by(Task.display_order.asc(), Task.created_at.asc(), Task.id.asc())
    )
    return list((await session.execute(stmt)).scalars())


async def _build_vision_view(
    session: AsyncSession,
    vision: Vision,
    *,
    tasks: list[Task] | None = None,
) -> VisionView:
    people_map = await load_people_for_entities(
        session,
        entity_ids=[vision.id],
        entity_type="vision",
    )
    return build_vision_view(
        vision,
        people=people_map.get(vision.id, ()),
        tasks=tasks or (),
    )


async def _build_vision_views(
    session: AsyncSession,
    visions: list[Vision],
) -> list[VisionView]:
    if not visions:
        return []
    people_map = await load_people_for_entities(
        session,
        entity_ids=[vision.id for vision in visions],
        entity_type="vision",
    )
    return [build_vision_view(vision, people=people_map.get(vision.id, ())) for vision in visions]


async def create_vision(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    status: str = "active",
    area_id: UUID | None = None,
    experience_rate_per_hour: int | None = None,
    person_ids: list[UUID] | None = None,
) -> VisionView:
    """Create a new vision."""
    normalized_name = name.strip()
    existing = await session.execute(
        select(Vision).where(Vision.name == normalized_name, Vision.deleted_at.is_(None)).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise VisionAlreadyExistsError(f"Vision with name {normalized_name!r} already exists")
    await _ensure_area_exists(session, area_id)
    vision = Vision(
        name=normalized_name,
        description=description,
        status=validate_vision_status(status),
        area_id=area_id,
        experience_rate_per_hour=validate_vision_experience_rate(experience_rate_per_hour),
    )
    session.add(vision)
    await session.flush()
    if person_ids is not None:
        await sync_entity_people(
            session, entity_id=vision.id, entity_type="vision", desired_person_ids=person_ids
        )
    await session.refresh(vision)
    return await _build_vision_view(session, vision)


async def get_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
    include_deleted: bool = False,
) -> VisionView | None:
    """Load a vision by identifier."""
    return await load_view_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=include_deleted,
        view_builder=_build_vision_view,
    )


async def list_visions(
    session: AsyncSession,
    *,
    status: str | None = None,
    area_id: UUID | None = None,
    person_id: UUID | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[VisionView]:
    """List visions."""
    stmt = select(Vision)
    if not include_deleted:
        stmt = stmt.where(Vision.deleted_at.is_(None))
    if status is not None:
        stmt = stmt.where(Vision.status == validate_vision_status(status))
    if area_id is not None:
        stmt = stmt.where(Vision.area_id == area_id)
    if person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Vision.id)
            & (person_associations.c.entity_type == "vision"),
        ).where(person_associations.c.person_id == person_id)
    stmt = stmt.order_by(Vision.created_at.desc(), Vision.id.desc()).offset(offset).limit(limit)
    visions = list((await session.execute(stmt)).scalars())
    return await _build_vision_views(session, visions)


async def update_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
    name: str | None = None,
    description: str | None = None,
    clear_description: bool = False,
    status: str | None = None,
    area_id: UUID | None = None,
    clear_area: bool = False,
    experience_rate_per_hour: int | None = None,
    clear_experience_rate: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> VisionView:
    """Update a vision."""
    vision = await load_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=False,
    )
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    if name is not None:
        normalized_name = name.strip()
        conflict = await session.execute(
            select(Vision.id).where(
                Vision.name == normalized_name,
                Vision.id != vision_id,
                Vision.deleted_at.is_(None),
            )
        )
        if conflict.scalar_one_or_none() is not None:
            raise VisionAlreadyExistsError(f"Vision with name {normalized_name!r} already exists")
        vision.name = normalized_name
    if clear_description:
        vision.description = None
    elif description is not None:
        vision.description = description
    if status is not None:
        vision.status = validate_vision_status(status)
    if clear_area:
        vision.area_id = None
    elif area_id is not None:
        await _ensure_area_exists(session, area_id)
        vision.area_id = area_id
    if clear_experience_rate:
        vision.experience_rate_per_hour = None
    elif experience_rate_per_hour is not None:
        vision.experience_rate_per_hour = validate_vision_experience_rate(experience_rate_per_hour)
    if clear_people:
        await sync_entity_people(
            session, entity_id=vision.id, entity_type="vision", desired_person_ids=[]
        )
    elif person_ids is not None:
        await sync_entity_people(
            session, entity_id=vision.id, entity_type="vision", desired_person_ids=person_ids
        )
    await session.flush()
    await session.refresh(vision)
    return await _build_vision_view(session, vision)


async def delete_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
) -> None:
    """Soft-delete a vision."""
    await soft_delete_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        not_found_error_factory=lambda missing_id: VisionNotFoundError(
            f"Vision {missing_id} was not found"
        ),
    )


async def add_experience_to_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
    experience_points: int,
) -> VisionView:
    """Add manual experience points to an active vision."""
    vision = await load_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=False,
    )
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    if vision.status != "active":
        raise ValueError("Can only add experience to active visions")
    effective_rate = resolve_experience_rate_for_vision(vision)
    _apply_effective_experience_rate(vision, effective_rate)
    vision.add_experience(validate_experience_points(experience_points))
    await session.flush()
    await session.refresh(vision)
    return await _build_vision_view(session, vision)


async def sync_vision_experience(
    session: AsyncSession,
    *,
    vision_id: UUID,
) -> VisionView:
    """Synchronize vision experience points from root task actual effort."""
    vision = await load_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=False,
    )
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    effective_rate = resolve_experience_rate_for_vision(vision)
    _apply_effective_experience_rate(vision, effective_rate)
    tasks = await _load_active_tasks_for_vision(session, vision.id)
    vision.sync_experience_with_actual_effort(
        experience_rate_per_hour=effective_rate,
        tasks=tasks,
    )
    await session.flush()
    await session.refresh(vision)
    return await _build_vision_view(session, vision)


async def get_vision_with_tasks(
    session: AsyncSession,
    *,
    vision_id: UUID,
) -> VisionView:
    """Load one vision with its active tasks included in the returned view."""
    vision = await load_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=False,
    )
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    tasks = await _load_active_tasks_for_vision(session, vision.id)
    return await _build_vision_view(session, vision, tasks=tasks)


async def get_vision_stats(
    session: AsyncSession,
    *,
    vision_id: UUID,
) -> VisionStats:
    """Return task statistics for a vision."""
    vision = await load_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=False,
    )
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")

    tasks = await _load_active_tasks_for_vision(session, vision.id)
    total_tasks = len(tasks)
    completed_tasks = len([task for task in tasks if task.status == "done"])
    in_progress_tasks = len([task for task in tasks if task.status == "in_progress"])
    todo_tasks = len([task for task in tasks if task.status == "todo"])
    completion_percentage = completed_tasks / total_tasks if total_tasks > 0 else 0.0
    total_estimated_effort = sum(task.estimated_effort or 0 for task in tasks)
    total_actual_effort = sum(
        task.actual_effort_total or 0 for task in tasks if task.parent_task_id is None
    )

    return VisionStats(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        in_progress_tasks=in_progress_tasks,
        todo_tasks=todo_tasks,
        completion_percentage=completion_percentage,
        total_estimated_effort=total_estimated_effort or None,
        total_actual_effort=total_actual_effort or None,
    )


async def harvest_vision(
    session: AsyncSession,
    *,
    vision_id: UUID,
) -> VisionView:
    """Harvest a mature active vision into fruit status."""
    vision = await load_model_by_id(
        session,
        model_cls=Vision,
        model_id=vision_id,
        include_deleted=False,
    )
    if vision is None:
        raise VisionNotFoundError(f"Vision {vision_id} was not found")
    if not vision.can_harvest():
        raise VisionNotReadyForHarvestError(
            "Vision is not ready for harvest (must be at final stage and active)"
        )
    effective_rate = resolve_experience_rate_for_vision(vision)
    _apply_effective_experience_rate(vision, effective_rate)
    vision.harvest()
    await session.flush()
    await session.refresh(vision)
    return await _build_vision_view(session, vision)


async def batch_delete_visions(
    session: AsyncSession,
    *,
    vision_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple visions while preserving per-vision error reporting."""
    return await batch_delete_records(
        identifiers=deduplicate_preserving_order(vision_ids),
        delete_record=lambda vision_id: delete_vision(session, vision_id=vision_id),
        handled_exceptions=(VisionNotFoundError,),
    )
