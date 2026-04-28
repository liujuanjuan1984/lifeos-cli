from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pytest

from lifeos_cli import cli
from lifeos_cli.config import clear_config_cache
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import habit_queries, habit_support, schedule_queries

_ID_PATTERN = re.compile(
    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)


def _extract_created_id(output: str) -> str:
    match = _ID_PATTERN.search(output)
    if match is None:
        raise AssertionError(f"could not find identifier in output: {output!r}")
    return match.group(1)


@pytest.fixture(autouse=True)
def _clear_sqlite_runtime(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    clear_config_cache()
    db_session.clear_session_cache()
    monkeypatch.setenv("LIFEOS_TIMEZONE", "UTC")
    yield
    clear_config_cache()
    db_session.clear_session_cache()


def test_cli_sqlite_workflow_supports_upgrade_and_core_queries(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "lifeos-config.toml"
    database_path = tmp_path / "sqlite" / "lifeos.db"
    database_url = f"sqlite+aiosqlite:///{database_path}"

    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(habit_support, "get_operational_date", lambda: date(2026, 4, 10))
    monkeypatch.setattr(habit_queries, "get_operational_date", lambda: date(2026, 4, 10))
    monkeypatch.setattr(schedule_queries, "get_operational_date", lambda: date(2026, 4, 10))

    init_exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            database_url,
            "--skip-ping",
            "--skip-migrate",
            "--timezone",
            "UTC",
            "--language",
            "en",
        ]
    )
    init_output = capsys.readouterr()

    assert init_exit_code == 0
    assert "Database URL: sqlite+aiosqlite://" in init_output.out
    assert "Database schema:" not in init_output.out

    ping_exit_code = cli.main(["db", "ping"])
    ping_output = capsys.readouterr()

    assert ping_exit_code == 0
    assert "Database connection succeeded." in ping_output.out

    upgrade_exit_code = cli.main(["db", "upgrade"])
    upgrade_output = capsys.readouterr()

    assert upgrade_exit_code == 0
    assert "Database migrations are up to date." in upgrade_output.out

    vision_exit_code = cli.main(["vision", "add", "Launch sqlite workflow"])
    vision_output = capsys.readouterr()

    assert vision_exit_code == 0
    vision_id = _extract_created_id(vision_output.out)

    task_exit_code = cli.main(
        [
            "task",
            "add",
            "Draft sqlite release checklist",
            "--vision-id",
            vision_id,
            "--planning-cycle-type",
            "week",
            "--planning-cycle-days",
            "7",
            "--planning-cycle-start-date",
            "2026-04-10",
        ]
    )
    task_output = capsys.readouterr()

    assert task_exit_code == 0
    task_id = _extract_created_id(task_output.out)

    habit_exit_code = cli.main(
        [
            "habit",
            "add",
            "Daily Review",
            "--start-date",
            "2026-04-10",
            "--duration-days",
            "7",
        ]
    )
    habit_output = capsys.readouterr()

    assert habit_exit_code == 0
    habit_id = _extract_created_id(habit_output.out)

    habit_list_exit_code = cli.main(
        ["habit", "list", "--status", "active", "--active-window-only", "--count"]
    )
    habit_list_output = capsys.readouterr()

    assert habit_list_exit_code == 0
    assert habit_id in habit_list_output.out
    assert "Total habits: 1" in habit_list_output.out

    schedule_exit_code = cli.main(["schedule", "show", "--date", "2026-04-10"])
    schedule_output = capsys.readouterr()

    assert schedule_exit_code == 0
    assert "date: 2026-04-10" in schedule_output.out
    assert "Draft sqlite release checklist" in schedule_output.out
    assert task_id in schedule_output.out
    assert "Daily Review" in schedule_output.out

    note_exit_code = cli.main(["note", "add", "Capture sqlite workflow"])
    note_output = capsys.readouterr()

    assert note_exit_code == 0
    note_id = _extract_created_id(note_output.out)

    note_list_exit_code = cli.main(["note", "list"])
    note_list_output = capsys.readouterr()

    assert note_list_exit_code == 0
    assert note_id in note_list_output.out
    assert "Capture sqlite workflow" in note_list_output.out
