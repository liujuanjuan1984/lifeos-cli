"""Support utilities and validations for event services."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.task import Task

VALID_EVENT_STATUSES = {"planned", "cancelled", "completed"}
VALID_EVENT_TYPES = {"appointment", "timeblock", "deadline"}
VALID_EVENT_RECURRENCE_FREQUENCIES = {"daily", "weekly"}
VALID_EVENT_OPERATION_SCOPES = {"single", "all_future", "all"}


class EventNotFoundError(LookupError):
    """Raised when an event cannot be found."""


class EventAreaReferenceNotFoundError(LookupError):
    """Raised when a referenced area cannot be found."""


class EventTaskReferenceNotFoundError(LookupError):
    """Raised when a referenced task cannot be found."""


class EventValidationError(ValueError):
    """Raised when event data is invalid."""


def validate_event_scope(scope: str) -> str:
    """Validate an event operation scope."""
    normalized = scope.strip().lower()
    if normalized not in VALID_EVENT_OPERATION_SCOPES:
        allowed = ", ".join(sorted(VALID_EVENT_OPERATION_SCOPES))
        raise EventValidationError(
            f"Invalid event scope {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def validate_event_status(status: str) -> str:
    """Validate an event status value."""
    normalized = status.strip().lower()
    if normalized not in VALID_EVENT_STATUSES:
        allowed = ", ".join(sorted(VALID_EVENT_STATUSES))
        raise EventValidationError(
            f"Invalid event status {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def validate_event_type(event_type: str) -> str:
    """Validate an event type value."""
    normalized = event_type.strip().lower()
    if normalized not in VALID_EVENT_TYPES:
        allowed = ", ".join(sorted(VALID_EVENT_TYPES))
        raise EventValidationError(f"Invalid event type {normalized!r}. Expected one of: {allowed}")
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


def normalize_event_datetime(value: datetime, *, field_name: str) -> datetime:
    """Normalize one event datetime to UTC for storage."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise EventValidationError(
            f"Event {field_name} must include timezone information, for example `-04:00` or `Z`."
        )
    return value.astimezone(timezone.utc)


def normalize_optional_event_datetime(
    value: datetime | None,
    *,
    field_name: str,
) -> datetime | None:
    """Normalize an optional event datetime to UTC for storage."""
    if value is None:
        return None
    return normalize_event_datetime(value, field_name=field_name)


def validate_event_priority(priority: int) -> int:
    """Validate event priority."""
    if priority < 0 or priority > 5:
        raise EventValidationError("Event priority must be between 0 and 5")
    return priority


def validate_event_recurrence(
    *,
    start_time: datetime,
    recurrence_frequency: str | None,
    recurrence_interval: int | None,
    recurrence_count: int | None,
    recurrence_until: datetime | None,
) -> tuple[str | None, int | None, int | None, datetime | None]:
    """Validate recurrence fields and normalize defaults."""
    if recurrence_frequency is None:
        if any(
            value is not None for value in (recurrence_interval, recurrence_count, recurrence_until)
        ):
            raise EventValidationError(
                "Recurrence interval, count, and until require recurrence_frequency."
            )
        return None, None, None, None

    normalized_frequency = recurrence_frequency.strip().lower()
    if normalized_frequency not in VALID_EVENT_RECURRENCE_FREQUENCIES:
        allowed = ", ".join(sorted(VALID_EVENT_RECURRENCE_FREQUENCIES))
        raise EventValidationError(
            f"Invalid recurrence frequency {normalized_frequency!r}. Expected one of: {allowed}"
        )

    normalized_interval = 1 if recurrence_interval is None else recurrence_interval
    if normalized_interval <= 0:
        raise EventValidationError("Recurrence interval must be greater than zero")
    if recurrence_count is not None and recurrence_count <= 0:
        raise EventValidationError("Recurrence count must be greater than zero")
    if recurrence_until is not None and recurrence_until < start_time:
        raise EventValidationError(
            "Recurrence until must be on or after the first event start time"
        )
    return normalized_frequency, normalized_interval, recurrence_count, recurrence_until


class RecurringEventLike(Protocol):
    """Structural event shape required for recurrence calculations."""

    start_time: datetime
    end_time: datetime | None
    recurrence_parent_event_id: UUID | None
    recurrence_frequency: str | None
    recurrence_interval: int | None
    recurrence_count: int | None
    recurrence_until: datetime | None


def event_is_recurring(event: RecurringEventLike) -> bool:
    """Return whether the event is a recurring master event."""
    return event.recurrence_parent_event_id is None and event.recurrence_frequency is not None


def event_recurrence_step(event: RecurringEventLike) -> timedelta:
    """Return the recurrence step for a recurring event."""
    frequency = event.recurrence_frequency
    interval = event.recurrence_interval or 1
    if frequency == "daily":
        return timedelta(days=interval)
    if frequency == "weekly":
        return timedelta(weeks=interval)
    raise EventValidationError("Recurring events require a supported recurrence frequency")


def get_event_occurrence_index(event: RecurringEventLike, *, instance_start: datetime) -> int:
    """Return the zero-based occurrence index for one recurring event instance."""
    start_time = event.start_time
    if instance_start < start_time:
        raise EventValidationError("Instance start must be on or after the master event start time")
    step = event_recurrence_step(event)
    delta_seconds = (instance_start - start_time).total_seconds()
    step_seconds = step.total_seconds()
    if delta_seconds % step_seconds != 0:
        raise EventValidationError("Instance start does not match the recurring event cadence")
    return int(delta_seconds // step_seconds)


def validate_event_instance_start(event: RecurringEventLike, *, instance_start: datetime) -> None:
    """Validate one recurring event instance start."""
    if not event_is_recurring(event):
        raise EventValidationError("Instance-level operations require a recurring master event")
    occurrence_index = get_event_occurrence_index(event, instance_start=instance_start)
    recurrence_count = event.recurrence_count
    recurrence_until = event.recurrence_until
    if recurrence_count is not None and occurrence_index >= recurrence_count:
        raise EventValidationError("Instance start falls outside the recurring series")
    if recurrence_until is not None and instance_start > recurrence_until:
        raise EventValidationError("Instance start falls outside the recurring series")


def get_previous_event_occurrence_start(
    event: RecurringEventLike, *, instance_start: datetime
) -> datetime | None:
    """Return the previous occurrence start for one recurring event instance."""
    validate_event_instance_start(event, instance_start=instance_start)
    if instance_start == event.start_time:
        return None
    return instance_start - event_recurrence_step(event)


def get_event_occurrence_starts_in_range(
    event: RecurringEventLike,
    *,
    window_start: datetime,
    window_end: datetime,
) -> list[datetime]:
    """Return occurrence start times that overlap the requested window."""
    if not event_is_recurring(event):
        return []

    starts: list[datetime] = []
    current_start = event.start_time
    recurrence_count = event.recurrence_count
    recurrence_until = event.recurrence_until
    end_time = event.end_time
    duration = end_time - current_start if end_time is not None else None
    step = event_recurrence_step(event)
    occurrence_index = 0

    while current_start <= window_end:
        if recurrence_count is not None and occurrence_index >= recurrence_count:
            break
        if recurrence_until is not None and current_start > recurrence_until:
            break
        current_end = current_start + duration if duration is not None else None
        if current_start <= window_end and (current_end is None or current_end >= window_start):
            starts.append(current_start)
        current_start += step
        occurrence_index += 1
    return starts


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
