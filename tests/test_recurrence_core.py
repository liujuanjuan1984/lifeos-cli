from __future__ import annotations

from lifeos_cli.db.services.recurrence_core import (
    build_series_definition,
    get_occurrence_starts_in_range,
    normalize_recurrence_rule_details,
)
from tests.support import utc_datetime


def test_recurrence_core_expands_weekly_byweekday() -> None:
    series = build_series_definition(
        anchor_start=utc_datetime(2026, 4, 6, 9, 0),
        anchor_end=None,
        frequency="weekly",
        byweekday=["monday", "wednesday", "friday"],
    )

    starts = get_occurrence_starts_in_range(
        series,
        window_start=utc_datetime(2026, 4, 6, 0, 0),
        window_end=utc_datetime(2026, 4, 12, 23, 59),
    )

    assert starts == [
        utc_datetime(2026, 4, 6, 9, 0),
        utc_datetime(2026, 4, 8, 9, 0),
        utc_datetime(2026, 4, 10, 9, 0),
    ]


def test_recurrence_core_expands_monthly_ordinal_weekday() -> None:
    series = build_series_definition(
        anchor_start=utc_datetime(2026, 4, 13, 9, 0),
        anchor_end=None,
        frequency="monthly",
        byweekday_ordinals=[{"weekday": "monday", "ordinal": 2}],
    )

    starts = get_occurrence_starts_in_range(
        series,
        window_start=utc_datetime(2026, 4, 1, 0, 0),
        window_end=utc_datetime(2026, 6, 30, 23, 59),
    )

    assert starts == [
        utc_datetime(2026, 4, 13, 9, 0),
        utc_datetime(2026, 5, 11, 9, 0),
        utc_datetime(2026, 6, 8, 9, 0),
    ]


def test_normalize_recurrence_rule_details_deduplicates_and_sorts() -> None:
    assert normalize_recurrence_rule_details(
        {
            "byweekday": ["friday", "monday", "monday"],
            "bymonthday": ["15", "1", "15"],
            "bymonth": ["12", "1"],
            "byweekday_ordinals": [
                {"weekday": "friday", "ordinal": "-1"},
                {"weekday": "friday", "ordinal": "-1"},
            ],
        }
    ) == {
        "byweekday": ["monday", "friday"],
        "bymonthday": [1, 15],
        "bymonth": [1, 12],
        "byweekday_ordinals": [{"weekday": "friday", "ordinal": -1}],
    }
