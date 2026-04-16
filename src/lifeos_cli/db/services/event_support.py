"""Support utilities and validations for event services."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.config import get_preferences_settings
from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.recurrence_core import (
    RecurrenceValidationError,
    SeriesDefinition,
    build_series_definition,
    get_occurrence_index,
    get_occurrence_starts_in_range,
    get_previous_occurrence_start,
    validate_occurrence_start,
)

VALID_EVENT_STATUSES = {"planned", "cancelled", "completed"}
VALID_EVENT_TYPES = {"appointment", "timeblock", "deadline"}
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

    try:
        normalized_rule = build_series_definition(
            anchor_start=start_time,
            anchor_end=None,
            frequency=recurrence_frequency,
            interval=recurrence_interval,
            count=recurrence_count,
            until=recurrence_until,
            week_starts_on=get_preferences_settings().week_starts_on,
        ).rule
    except RecurrenceValidationError as exc:
        raise EventValidationError(str(exc)) from exc
    return (
        normalized_rule.frequency,
        normalized_rule.interval,
        normalized_rule.count,
        normalized_rule.until,
    )


class RecurringEventLike(Protocol):
    """Structural event shape required for recurrence calculations."""

    start_time: datetime
    end_time: datetime | None
    recurrence_parent_event_id: UUID | None
    recurrence_frequency: str | None
    recurrence_interval: int | None
    recurrence_count: int | None
    recurrence_until: datetime | None


def _build_event_series(event: RecurringEventLike) -> SeriesDefinition:
    assert event.recurrence_frequency is not None
    return build_series_definition(
        anchor_start=event.start_time,
        anchor_end=event.end_time,
        frequency=event.recurrence_frequency,
        interval=event.recurrence_interval,
        count=event.recurrence_count,
        until=event.recurrence_until,
        week_starts_on=get_preferences_settings().week_starts_on,
    )


def event_is_recurring(event: RecurringEventLike) -> bool:
    """Return whether the event is a recurring master event."""
    return event.recurrence_parent_event_id is None and event.recurrence_frequency is not None


def get_event_occurrence_index(event: RecurringEventLike, *, instance_start: datetime) -> int:
    """Return the zero-based occurrence index for one recurring event instance."""
    try:
        return get_occurrence_index(_build_event_series(event), instance_start=instance_start)
    except RecurrenceValidationError as exc:
        raise EventValidationError(str(exc)) from exc


def validate_event_instance_start(event: RecurringEventLike, *, instance_start: datetime) -> None:
    """Validate one recurring event instance start."""
    if not event_is_recurring(event):
        raise EventValidationError("Instance-level operations require a recurring master event")
    try:
        validate_occurrence_start(_build_event_series(event), instance_start=instance_start)
    except RecurrenceValidationError as exc:
        raise EventValidationError(str(exc)) from exc


def get_previous_event_occurrence_start(
    event: RecurringEventLike, *, instance_start: datetime
) -> datetime | None:
    """Return the previous occurrence start for one recurring event instance."""
    try:
        return get_previous_occurrence_start(
            _build_event_series(event),
            instance_start=instance_start,
        )
    except RecurrenceValidationError as exc:
        raise EventValidationError(str(exc)) from exc


def get_event_occurrence_starts_in_range(
    event: RecurringEventLike,
    *,
    window_start: datetime,
    window_end: datetime,
) -> list[datetime]:
    """Return occurrence start times that overlap the requested window."""
    if not event_is_recurring(event):
        return []
    return get_occurrence_starts_in_range(
        _build_event_series(event),
        window_start=window_start,
        window_end=window_end,
    )


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
