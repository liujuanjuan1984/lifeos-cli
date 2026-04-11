from __future__ import annotations

from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace

import pytest

from lifeos_cli.db import maintenance


def test_build_alembic_config_uses_packaged_migration_resources() -> None:
    with ExitStack() as stack:
        config = maintenance.build_alembic_config(
            sqlalchemy_url="postgresql+psycopg://localhost/lifeos",
            stack=stack,
        )
        script_location_text = config.get_main_option("script_location")

        assert script_location_text is not None
        script_location = Path(script_location_text)

        assert config.get_main_option("sqlalchemy.url") == "postgresql+psycopg://localhost/lifeos"
        assert script_location.name == "alembic"
        assert script_location.joinpath("env.py").is_file()
        assert script_location.joinpath("script.py.mako").is_file()
        assert script_location.joinpath(
            "versions",
            "20260410_1200_add_event_recurrence_support.py",
        ).is_file()
        assert script_location.joinpath(
            "versions",
            "20260411_0900_add_timelog_stats_groupby_area_tables.py",
        ).is_file()


def test_upgrade_database_uses_packaged_alembic_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_upgrade(config: object, revision: str) -> None:
        captured["config"] = config
        captured["revision"] = revision

    monkeypatch.setattr(
        maintenance,
        "get_database_settings",
        lambda: SimpleNamespace(
            require_database_url=lambda: "postgresql+psycopg://localhost/lifeos_test"
        ),
    )
    monkeypatch.setattr(maintenance.command, "upgrade", fake_upgrade)

    maintenance.upgrade_database("head")

    config = captured["config"]
    assert captured["revision"] == "head"
    assert isinstance(config, maintenance.Config)
    assert config.get_main_option("sqlalchemy.url") == "postgresql+psycopg://localhost/lifeos_test"
    script_location_text = config.get_main_option("script_location")
    assert script_location_text is not None
    assert Path(script_location_text).joinpath("env.py").is_file()
