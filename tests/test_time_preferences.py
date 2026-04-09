from __future__ import annotations

from datetime import date, datetime, timezone

from lifeos_cli.config import clear_config_cache
from lifeos_cli.time_preferences import (
    get_current_week_bounds,
    get_operational_date,
    get_utc_window_for_local_date,
    to_preferred_timezone,
)


def test_to_preferred_timezone_uses_configured_timezone(monkeypatch, tmp_path) -> None:
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
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    converted = to_preferred_timezone(datetime(2026, 4, 10, 7, 30, tzinfo=timezone.utc))

    assert converted.isoformat() == "2026-04-10T03:30:00-04:00"
    clear_config_cache()


def test_get_operational_date_respects_day_start_boundary(monkeypatch, tmp_path) -> None:
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
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    before_boundary = datetime(2026, 4, 10, 6, 0, tzinfo=timezone.utc)
    after_boundary = datetime(2026, 4, 10, 12, 0, tzinfo=timezone.utc)

    assert get_operational_date(before_boundary) == date(2026, 4, 9)
    assert get_operational_date(after_boundary) == date(2026, 4, 10)
    clear_config_cache()


def test_get_utc_window_for_local_date_respects_day_start_boundary(monkeypatch, tmp_path) -> None:
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
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    window_start, window_end = get_utc_window_for_local_date(date(2026, 4, 10))

    assert window_start.isoformat() == "2026-04-10T08:00:00+00:00"
    assert window_end.isoformat() == "2026-04-11T08:00:00+00:00"
    clear_config_cache()


def test_get_current_week_bounds_respects_configured_week_start(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[preferences]",
                'timezone = "America/Toronto"',
                'language = "en"',
                'day_starts_at = "04:00"',
                'week_starts_on = "sunday"',
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    week_start, week_end = get_current_week_bounds(date(2026, 4, 9))

    assert week_start == date(2026, 4, 5)
    assert week_end == date(2026, 4, 11)
    clear_config_cache()
