from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime, timezone

import pytest

from lifeos_cli.config import clear_config_cache
from lifeos_cli.db.services import timelog_stats
from tests.config_support import install_test_config


@pytest.fixture
def configured_time_preferences(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Iterator[None]:
    install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        week_starts_on="sunday",
    )
    yield
    clear_config_cache()


@pytest.mark.usefixtures("configured_time_preferences")
def test_iter_local_dates_for_timelog_window_respects_day_boundary() -> None:
    local_dates = timelog_stats.iter_local_dates_for_timelog_window(
        start_time=datetime(2026, 4, 10, 7, 30, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 10, 9, 30, tzinfo=timezone.utc),
    )

    assert local_dates == (date(2026, 4, 9), date(2026, 4, 10))


def test_overlap_minutes_for_window_returns_whole_minutes() -> None:
    minutes = timelog_stats.overlap_minutes_for_window(
        start_time=datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 10, 13, 1, tzinfo=timezone.utc),
        window_start=datetime(2026, 4, 10, 12, 30, tzinfo=timezone.utc),
        window_end=datetime(2026, 4, 10, 13, 0, 59, tzinfo=timezone.utc),
    )

    assert minutes == 30


@pytest.mark.usefixtures("configured_time_preferences")
def test_resolve_stats_period_uses_configured_week_boundary() -> None:
    start_date, end_date = timelog_stats.resolve_stats_period(
        granularity="week",
        target_date=date(2026, 4, 9),
    )

    assert start_date == date(2026, 4, 5)
    assert end_date == date(2026, 4, 11)


def test_get_month_bounds_returns_full_calendar_month() -> None:
    start_date, end_date = timelog_stats.get_month_bounds(date(2026, 2, 1))

    assert start_date == date(2026, 2, 1)
    assert end_date == date(2026, 2, 28)


def test_get_year_bounds_returns_full_calendar_year() -> None:
    start_date, end_date = timelog_stats.get_year_bounds(2026)

    assert start_date == date(2026, 1, 1)
    assert end_date == date(2026, 12, 31)
