from __future__ import annotations

from datetime import date, datetime

from lifeos_cli.cli_support.time_args import (
    normalize_query_datetime_bound,
    resolve_date_interval_arguments,
)
from lifeos_cli.config import clear_config_cache


def _write_preferences_config(tmp_path) -> str:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[preferences]",
                'timezone = "America/Toronto"',
                'language = "en"',
                'day_starts_at = "04:00"',
                'week_starts_on = "monday"',
                "",
            )
        ),
        encoding="utf-8",
    )
    return str(config_path)


def test_resolve_date_interval_arguments_treats_repeated_date_as_inclusive_range() -> None:
    start_date, end_date = resolve_date_interval_arguments(
        date_values=[date(2026, 4, 10), date(2026, 4, 11)],
    )

    assert start_date == date(2026, 4, 10)
    assert end_date == date(2026, 4, 11)


def test_normalize_query_datetime_bound_uses_preferred_timezone_for_date_only(
    monkeypatch,
    tmp_path,
) -> None:
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", _write_preferences_config(tmp_path))

    start_bound = normalize_query_datetime_bound(date(2026, 4, 10), is_end=False)
    end_bound = normalize_query_datetime_bound(date(2026, 4, 10), is_end=True)

    assert start_bound is not None
    assert end_bound is not None
    assert start_bound.isoformat() == "2026-04-10T04:00:00+00:00"
    assert end_bound.isoformat() == "2026-04-11T03:59:59.999999+00:00"
    clear_config_cache()


def test_normalize_query_datetime_bound_uses_preferred_timezone_for_naive_datetime(
    monkeypatch,
    tmp_path,
) -> None:
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", _write_preferences_config(tmp_path))

    bound = normalize_query_datetime_bound(datetime(2026, 4, 10, 18, 0), is_end=False)

    assert bound is not None
    assert bound.isoformat() == "2026-04-10T22:00:00+00:00"
    clear_config_cache()
