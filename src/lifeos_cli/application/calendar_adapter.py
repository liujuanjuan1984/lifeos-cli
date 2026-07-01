"""Calendar period adapters shared by Web and application services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, Protocol

from lifeos_cli.config import (
    DEFAULT_CALENDAR_FIRST_DAY_OF_WEEK,
    DEFAULT_CALENDAR_SYSTEM,
    validate_calendar_first_day_of_week,
    validate_calendar_system,
)

CalendarGranularity = Literal["day", "week", "month", "year"]


class CalendarAdapter(Protocol):
    """Interface for calendar-specific period boundaries."""

    def week_range(self, target: date, first_day_of_week: int) -> tuple[date, date]:
        """Return inclusive week boundaries for the target date."""

    def month_range(self, target: date) -> tuple[date, date]:
        """Return inclusive month boundaries for the target date."""

    def year_range(self, target: date) -> tuple[date, date]:
        """Return inclusive year boundaries for the target date."""


@dataclass(frozen=True)
class GregorianCalendarAdapter:
    """Standard Gregorian calendar adapter."""

    def week_range(self, target: date, first_day_of_week: int) -> tuple[date, date]:
        normalized_first_day = validate_calendar_first_day_of_week(first_day_of_week)
        offset = (target.isoweekday() - normalized_first_day) % 7
        start = target - timedelta(days=offset)
        return start, start + timedelta(days=6)

    def month_range(self, target: date) -> tuple[date, date]:
        start = target.replace(day=1)
        if start.month == 12:
            next_month = date(start.year + 1, 1, 1)
        else:
            next_month = date(start.year, start.month + 1, 1)
        return start, next_month - timedelta(days=1)

    def year_range(self, target: date) -> tuple[date, date]:
        return date(target.year, 1, 1), date(target.year, 12, 31)


@dataclass(frozen=True)
class MayanCalendarAdapter:
    """Mayan 13 Moon calendar adapter with 13 28-day moons and Day Out of Time."""

    day_out_of_time_offset: int = 364
    moon_length_days: int = 28

    def year_start(self, target: date) -> date:
        july_26 = date(target.year, 7, 26)
        if target >= july_26:
            return july_26
        return date(target.year - 1, 7, 26)

    def day_offset(self, target: date) -> int:
        return (target - self.year_start(target)).days

    def _day_out_of_time_range(self, target: date) -> tuple[date, date]:
        day_out = self.year_start(target) + timedelta(days=self.day_out_of_time_offset)
        return day_out, day_out

    def week_range(self, target: date, first_day_of_week: int) -> tuple[date, date]:
        del first_day_of_week
        offset = self.day_offset(target)
        if offset >= self.day_out_of_time_offset:
            return self._day_out_of_time_range(target)
        start = self.year_start(target) + timedelta(days=(offset // 7) * 7)
        return start, start + timedelta(days=6)

    def month_range(self, target: date) -> tuple[date, date]:
        offset = self.day_offset(target)
        if offset >= self.day_out_of_time_offset:
            return self._day_out_of_time_range(target)
        start = self.year_start(target) + timedelta(
            days=(offset // self.moon_length_days) * self.moon_length_days
        )
        return start, start + timedelta(days=self.moon_length_days - 1)

    def year_range(self, target: date) -> tuple[date, date]:
        start = self.year_start(target)
        return start, start.replace(year=start.year + 1) - timedelta(days=1)


def get_calendar_adapter(system: str | None = None) -> CalendarAdapter:
    """Return the adapter for a validated calendar system."""
    normalized = validate_calendar_system(system or DEFAULT_CALENDAR_SYSTEM)
    if normalized == "mayan_13_moon":
        return MayanCalendarAdapter()
    return GregorianCalendarAdapter()


def get_calendar_period_range(
    granularity: CalendarGranularity,
    target: date,
    *,
    calendar_system: str | None = None,
    first_day_of_week: int | None = None,
) -> tuple[date, date]:
    """Return inclusive period boundaries for a target date."""
    if granularity == "day":
        return target, target

    adapter = get_calendar_adapter(calendar_system)
    normalized_first_day = validate_calendar_first_day_of_week(
        first_day_of_week or DEFAULT_CALENDAR_FIRST_DAY_OF_WEEK
    )
    if granularity == "week":
        return adapter.week_range(target, normalized_first_day)
    if granularity == "month":
        return adapter.month_range(target)
    if granularity == "year":
        return adapter.year_range(target)
    raise ValueError(f"Unsupported calendar granularity: {granularity}")


def iter_calendar_periods(
    *,
    start: date,
    end: date,
    granularity: CalendarGranularity,
    calendar_system: str | None = None,
    first_day_of_week: int | None = None,
) -> tuple[tuple[date, date], ...]:
    """Return sorted unique period buckets touched by an inclusive date range."""
    if end < start:
        raise ValueError("end must be on or after start")

    periods: dict[tuple[date, date], None] = {}
    cursor = start
    while cursor <= end:
        periods.setdefault(
            get_calendar_period_range(
                granularity,
                cursor,
                calendar_system=calendar_system,
                first_day_of_week=first_day_of_week,
            ),
            None,
        )
        cursor += timedelta(days=1)
    return tuple(sorted(periods, key=lambda period: (period[0], period[1])))
