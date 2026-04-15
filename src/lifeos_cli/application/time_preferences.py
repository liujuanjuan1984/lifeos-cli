"""Helpers for applying user time preferences at runtime."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from lifeos_cli.config import get_preferences_settings


def get_preferred_timezone() -> ZoneInfo:
    """Return the configured IANA timezone."""
    return ZoneInfo(get_preferences_settings().timezone)


def get_day_start_time() -> time:
    """Return the configured local day boundary."""
    hour, minute = (int(part) for part in get_preferences_settings().day_starts_at.split(":"))
    return time(hour=hour, minute=minute)


def to_preferred_timezone(value: datetime) -> datetime:
    """Convert a stored timestamp to the preferred display timezone."""
    preferred_timezone = get_preferred_timezone()
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(preferred_timezone)


def get_local_now() -> datetime:
    """Return the current local datetime using the preferred timezone."""
    return datetime.now(timezone.utc).astimezone(get_preferred_timezone())


def get_operational_date(value: datetime | None = None) -> date:
    """Return the configured local date after applying the day-start boundary."""
    local_value = to_preferred_timezone(value or get_local_now())
    day_start = get_day_start_time()
    local_clock = time(
        hour=local_value.hour,
        minute=local_value.minute,
        second=local_value.second,
        microsecond=local_value.microsecond,
    )
    if local_clock < day_start:
        return (local_value - timedelta(days=1)).date()
    return local_value.date()


def get_utc_window_for_local_date(target_date: date) -> tuple[datetime, datetime]:
    """Return the UTC datetime window for one configured local operational day."""
    preferred_timezone = get_preferred_timezone()
    local_start = datetime.combine(target_date, get_day_start_time(), tzinfo=preferred_timezone)
    local_end = local_start + timedelta(days=1)
    return (
        local_start.astimezone(timezone.utc),
        local_end.astimezone(timezone.utc),
    )


def get_utc_window_for_local_date_range(
    start_date: date,
    end_date: date,
) -> tuple[datetime, datetime]:
    """Return the inclusive UTC datetime window for a local-date range."""
    range_start, _ = get_utc_window_for_local_date(start_date)
    _, range_end_exclusive = get_utc_window_for_local_date(end_date)
    return range_start, range_end_exclusive - timedelta(microseconds=1)


def get_week_bounds(reference_date: date) -> tuple[date, date]:
    """Return the configured week start and end dates for one local date."""
    week_starts_on = get_preferences_settings().week_starts_on
    weekday = reference_date.weekday()
    if week_starts_on == "sunday":
        days_since_week_start = (weekday + 1) % 7
    else:
        days_since_week_start = weekday
    week_start = reference_date - timedelta(days=days_since_week_start)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def get_current_week_bounds(reference_date: date | None = None) -> tuple[date, date]:
    """Return the configured current week start and end dates."""
    active_date = reference_date or get_operational_date()
    return get_week_bounds(active_date)
