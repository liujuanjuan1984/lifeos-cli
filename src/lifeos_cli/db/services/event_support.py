"""Support utilities and validations for event services."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.task import Task

VALID_EVENT_STATUSES = {"planned", "cancelled", "completed"}


class EventNotFoundError(LookupError):
    """Raised when an event cannot be found."""


class EventAreaReferenceNotFoundError(LookupError):
    """Raised when a referenced area cannot be found."""


class EventTaskReferenceNotFoundError(LookupError):
    """Raised when a referenced task cannot be found."""


class EventValidationError(ValueError):
    """Raised when event data is invalid."""


def validate_event_status(status: str) -> str:
    """Validate an event status value."""
    normalized = status.strip().lower()
    if normalized not in VALID_EVENT_STATUSES:
        allowed = ", ".join(sorted(VALID_EVENT_STATUSES))
        raise EventValidationError(
            f"Invalid event status {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def validate_event_title(title: str) -> str:
    """Validate and normalize an event title."""
    normalized = title.strip()
    if not normalized:
        raise EventValidationError("Event title must not be empty")
    if len(normalized) > 200:
        raise EventValidationError("Event title must be 200 characters or fewer")
    return normalized


def validate_event_time_range(
    *,
    start_time: datetime,
    end_time: datetime | None,
) -> None:
    """Validate that an event time range is coherent."""
    if end_time is not None and end_time < start_time:
        raise EventValidationError("Event end time must be on or after the start time")


def validate_event_priority(priority: int) -> int:
    """Validate event priority."""
    if priority < 0 or priority > 5:
        raise EventValidationError("Event priority must be between 0 and 5")
    return priority


async def ensure_event_area_exists(session: AsyncSession, area_id: UUID | None) -> None:
    """Ensure an optional event area reference exists."""
    if area_id is None:
        return
    stmt = select(Area.id).where(Area.id == area_id, Area.deleted_at.is_(None)).limit(1)
    if (await session.scalar(stmt)) is None:
        raise EventAreaReferenceNotFoundError(f"Area {area_id} was not found")


async def ensure_event_task_exists(session: AsyncSession, task_id: UUID | None) -> None:
    """Ensure an optional event task reference exists."""
    if task_id is None:
        return
    stmt = select(Task.id).where(Task.id == task_id, Task.deleted_at.is_(None)).limit(1)
    if (await session.scalar(stmt)) is None:
        raise EventTaskReferenceNotFoundError(f"Task {task_id} was not found")


def deduplicate_event_ids(event_ids: list[UUID]) -> list[UUID]:
    """Return event identifiers in original order without duplicates."""
    return list(dict.fromkeys(event_ids))
