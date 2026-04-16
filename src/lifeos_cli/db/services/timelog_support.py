"""Support utilities and validations for timelog services."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.model_utils import ensure_optional_reference_exists

VALID_TIMELOG_TRACKING_METHODS = {"manual", "automatic", "imported"}


class TimelogNotFoundError(LookupError):
    """Raised when a timelog cannot be found."""


class TimelogAreaReferenceNotFoundError(LookupError):
    """Raised when a referenced area cannot be found."""


class TimelogTaskReferenceNotFoundError(LookupError):
    """Raised when a referenced task cannot be found."""


class TimelogValidationError(ValueError):
    """Raised when timelog data is invalid."""


def validate_timelog_title(title: str) -> str:
    """Validate and normalize a timelog title."""
    normalized = title.strip()
    if not normalized:
        raise TimelogValidationError("Timelog title must not be empty")
    if len(normalized) > 200:
        raise TimelogValidationError("Timelog title must be 200 characters or fewer")
    return normalized


def validate_timelog_time_range(*, start_time: datetime, end_time: datetime) -> None:
    """Validate a timelog time range."""
    if end_time < start_time:
        raise TimelogValidationError("Timelog end time must be on or after the start time")


def normalize_timelog_datetime(value: datetime, *, field_name: str) -> datetime:
    """Normalize one timelog datetime to UTC for storage."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise TimelogValidationError(
            f"Timelog {field_name} must include timezone information, for example `-04:00` or `Z`."
        )
    return value.astimezone(timezone.utc)


def validate_tracking_method(tracking_method: str) -> str:
    """Validate and normalize a tracking method."""
    normalized = tracking_method.strip().lower()
    if normalized not in VALID_TIMELOG_TRACKING_METHODS:
        allowed = ", ".join(sorted(VALID_TIMELOG_TRACKING_METHODS))
        raise TimelogValidationError(
            f"Invalid tracking method {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def validate_energy_level(energy_level: int | None) -> int | None:
    """Validate an optional energy level."""
    if energy_level is None:
        return None
    if energy_level < 1 or energy_level > 5:
        raise TimelogValidationError("Energy level must be between 1 and 5")
    return energy_level


async def ensure_timelog_area_exists(session: AsyncSession, area_id: UUID | None) -> None:
    """Ensure an optional timelog area reference exists."""
    await ensure_optional_reference_exists(
        session,
        model_cls=Area,
        model_id=area_id,
        not_found_error_factory=lambda missing_id: TimelogAreaReferenceNotFoundError(
            f"Area {missing_id} was not found"
        ),
    )


async def ensure_timelog_task_exists(session: AsyncSession, task_id: UUID | None) -> None:
    """Ensure an optional timelog task reference exists."""
    await ensure_optional_reference_exists(
        session,
        model_cls=Task,
        model_id=task_id,
        not_found_error_factory=lambda missing_id: TimelogTaskReferenceNotFoundError(
            f"Task {missing_id} was not found"
        ),
    )
