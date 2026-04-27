from __future__ import annotations

from datetime import date
from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import timelog_stats
from tests.support import make_session_scope


def test_main_timelog_stats_day_prints_grouped_area_rows(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_get_day_stats(session: object, *, target_date: date) -> object:
        assert target_date == date(2026, 4, 10)
        return timelog_stats.TimelogStatsReport(
            granularity="day",
            start_date=target_date,
            end_date=target_date,
            timezone="America/Toronto",
            rows=(
                timelog_stats.TimelogAreaStatsRow(
                    area_id=UUID("11111111-1111-1111-1111-111111111111"),
                    area_name="Health",
                    minutes=90,
                    timelog_count=2,
                ),
            ),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelog_stats, "get_timelog_stats_groupby_area_for_day", fake_get_day_stats)

    exit_code = cli.main(["timelog", "stats", "day", "--date", "2026-04-10"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "granularity: day" in captured.out
    assert "timezone: America/Toronto" in captured.out
    assert "area_stats:" in captured.out
    assert "Health" in captured.out
    assert "90" in captured.out
    assert "2" in captured.out


def test_main_timelog_stats_range_rejects_inverted_dates(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "timelog",
            "stats",
            "range",
            "--start-date",
            "2026-04-11",
            "--end-date",
            "2026-04-10",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "The --end-date value must be on or after --start-date." in captured.err


def test_main_timelog_stats_rebuild_reports_discrete_date_scope(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_rebuild(session: object, **kwargs: object) -> tuple[date, ...]:
        assert kwargs["date_values"] == (date(2026, 4, 1), date(2026, 4, 3))
        assert kwargs["start_date"] is None
        assert kwargs["end_date"] is None
        return (date(2026, 4, 1), date(2026, 4, 3))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelog_stats, "rebuild_timelog_stats_groupby_area", fake_rebuild)

    exit_code = cli.main(
        [
            "timelog",
            "stats",
            "rebuild",
            "--date",
            "2026-04-01",
            "--date",
            "2026-04-03",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Rebuilt timelog stats grouped by area for 2 dates." in captured.out
    assert "dates: 2026-04-01, 2026-04-03" in captured.out
    assert "start_date:" not in captured.out
    assert "end_date:" not in captured.out


def test_main_timelog_stats_rebuild_normalizes_discrete_date_boundaries(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_rebuild(session: object, **kwargs: object) -> tuple[date, ...]:
        assert kwargs["date_values"] == (date(2026, 4, 3), date(2026, 4, 1))
        return (date(2026, 4, 3), date(2026, 4, 1))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelog_stats, "rebuild_timelog_stats_groupby_area", fake_rebuild)

    exit_code = cli.main(
        [
            "timelog",
            "stats",
            "rebuild",
            "--date",
            "2026-04-03",
            "--date",
            "2026-04-01",
            "--date",
            "2026-04-03",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Rebuilt timelog stats grouped by area for 2 dates." in captured.out
    assert "dates: 2026-04-03, 2026-04-01" in captured.out
    assert "start_date:" not in captured.out
    assert "end_date:" not in captured.out


def test_main_timelog_stats_rebuild_range_reports_explicit_boundaries(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_rebuild(session: object, **kwargs: object) -> tuple[date, ...]:
        assert kwargs["date_values"] == ()
        assert kwargs["start_date"] == date(2026, 4, 1)
        assert kwargs["end_date"] == date(2026, 4, 3)
        return (date(2026, 4, 1), date(2026, 4, 2), date(2026, 4, 3))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelog_stats, "rebuild_timelog_stats_groupby_area", fake_rebuild)

    exit_code = cli.main(
        [
            "timelog",
            "stats",
            "rebuild",
            "--start-date",
            "2026-04-01",
            "--end-date",
            "2026-04-03",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Rebuilt timelog stats grouped by area for 3 dates." in captured.out
    assert "start_date: 2026-04-01" in captured.out
    assert "end_date: 2026-04-03" in captured.out
