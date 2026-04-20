from __future__ import annotations

from datetime import date, datetime

from lifeos_cli.cli_support.time_args import (
    normalize_query_datetime_bound,
    parse_user_datetime_value,
    resolve_date_interval_arguments,
    resolve_exclusive_date_or_datetime_query,
    resolve_required_date_interval_arguments,
)
from lifeos_cli.config import clear_config_cache
from tests.config_support import install_test_config


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
    install_test_config(monkeypatch=monkeypatch, tmp_path=tmp_path, include_preferences=True)

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
    install_test_config(monkeypatch=monkeypatch, tmp_path=tmp_path, include_preferences=True)

    bound = normalize_query_datetime_bound(datetime(2026, 4, 10, 18, 0), is_end=False)

    assert bound is not None
    assert bound.isoformat() == "2026-04-10T22:00:00+00:00"
    clear_config_cache()


def test_parse_user_datetime_value_preserves_naive_input_shape() -> None:
    parsed = parse_user_datetime_value("2026-04-10T18:00:00")

    assert parsed == datetime(2026, 4, 10, 18, 0)
    assert parsed.tzinfo is None


def test_resolve_required_date_interval_arguments_rejects_empty_input() -> None:
    try:
        resolve_required_date_interval_arguments(date_values=None)
    except ValueError as exc:
        assert str(exc) == "Provide --date once or twice."
    else:
        raise AssertionError("expected DateArgumentError")


def test_resolve_exclusive_date_or_datetime_query_rejects_mixed_filters(
    monkeypatch,
    tmp_path,
) -> None:
    clear_config_cache()
    install_test_config(monkeypatch=monkeypatch, tmp_path=tmp_path, include_preferences=True)

    try:
        resolve_exclusive_date_or_datetime_query(
            date_values=[date(2026, 4, 10)],
            window_start=datetime(2026, 4, 10, 9, 0),
            window_end=None,
        )
    except ValueError as exc:
        assert str(exc) == "Use either --date or --start-time/--end-time, not both."
    else:
        raise AssertionError("expected DateArgumentError")
    finally:
        clear_config_cache()
