"""Shared CLI helpers for date and time query arguments."""

from __future__ import annotations

import argparse
import re
from datetime import date, datetime, time, timezone

from lifeos_cli.application.time_preferences import get_preferred_timezone

_DATE_ONLY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class DateArgumentError(ValueError):
    """Raised when CLI date arguments do not form a valid interval."""


def parse_date_value(value: str) -> date:
    """Parse one ISO local date value."""
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def parse_datetime_or_date_value(value: str) -> datetime | date:
    """Parse one ISO datetime or date value for query filters."""
    if _DATE_ONLY_PATTERN.fullmatch(value):
        return parse_date_value(value)
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def resolve_date_interval_arguments(
    *,
    date_values: list[date] | None,
) -> tuple[date | None, date | None]:
    """Resolve one canonical inclusive date interval from CLI flags."""
    repeated_dates = list(date_values or [])
    if len(repeated_dates) > 2:
        raise DateArgumentError(
            "Use --date once for one date or twice for one inclusive date range."
        )
    if len(repeated_dates) == 1:
        return repeated_dates[0], repeated_dates[0]
    if len(repeated_dates) == 2:
        first_date, second_date = repeated_dates
        if second_date < first_date:
            raise DateArgumentError(
                "When --date is repeated, the second date must be on or after the first date."
            )
        return first_date, second_date
    return None, None


def normalize_query_datetime_bound(
    value: datetime | date | None,
    *,
    is_end: bool,
) -> datetime | None:
    """Normalize one CLI query datetime bound into UTC."""
    if value is None:
        return None
    preferred_timezone = get_preferred_timezone()
    if isinstance(value, date) and not isinstance(value, datetime):
        local_time = time.max if is_end else time.min
        value = datetime.combine(value, local_time, tzinfo=preferred_timezone)
    elif value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=preferred_timezone)
    return value.astimezone(timezone.utc)
