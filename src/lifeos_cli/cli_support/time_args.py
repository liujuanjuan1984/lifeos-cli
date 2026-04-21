"""Shared CLI helpers for date and time query arguments."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import date, datetime, time

from lifeos_cli.application.time_preferences import to_storage_timezone

_DATE_ONLY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class DateArgumentError(ValueError):
    """Raised when CLI date arguments do not form a valid interval."""


@dataclass(frozen=True)
class ResolvedDateTimeQuery:
    """Normalized date-or-time query filters for list commands."""

    start_date: date | None
    end_date: date | None
    window_start: datetime | None
    window_end: datetime | None


def parse_date_value(value: str) -> date:
    """Parse one ISO local date value."""
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def parse_optional_date_value(value: str | None) -> date | None:
    """Parse one optional ISO local date value."""
    if value is None:
        return None
    return date.fromisoformat(value)


def parse_datetime_or_date_value(value: str) -> datetime | date:
    """Parse one ISO datetime or date value for query filters."""
    if _DATE_ONLY_PATTERN.fullmatch(value):
        return parse_date_value(value)
    return parse_user_datetime_value(value)


def parse_user_datetime_value(value: str) -> datetime:
    """Parse one ISO datetime value for user-facing write arguments."""
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


def resolve_required_date_interval_arguments(
    *,
    date_values: list[date] | None,
    empty_message: str = "Provide --date once or twice.",
) -> tuple[date, date]:
    """Resolve one required inclusive date interval from CLI flags."""
    start_date, end_date = resolve_date_interval_arguments(date_values=date_values)
    if start_date is None or end_date is None:
        raise DateArgumentError(empty_message)
    return start_date, end_date


def normalize_query_datetime_bound(
    value: datetime | date | None,
    *,
    is_end: bool,
) -> datetime | None:
    """Normalize one CLI query datetime bound into UTC."""
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        local_time = time.max if is_end else time.min
        value = datetime.combine(value, local_time)
    return to_storage_timezone(value)


def resolve_exclusive_date_or_datetime_query(
    *,
    date_values: list[date] | None,
    window_start: datetime | date | None,
    window_end: datetime | date | None,
    conflict_message: str = "Use either --date or --start-time/--end-time, not both.",
) -> ResolvedDateTimeQuery:
    """Resolve one query scope that may be either a date interval or a datetime window."""
    start_date, end_date = resolve_date_interval_arguments(date_values=date_values)
    normalized_window_start = normalize_query_datetime_bound(window_start, is_end=False)
    normalized_window_end = normalize_query_datetime_bound(window_end, is_end=True)
    if (start_date is not None or end_date is not None) and (
        normalized_window_start is not None or normalized_window_end is not None
    ):
        raise DateArgumentError(conflict_message)
    return ResolvedDateTimeQuery(
        start_date=start_date,
        end_date=end_date,
        window_start=normalized_window_start,
        window_end=normalized_window_end,
    )
