from __future__ import annotations

import asyncio
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from lifeos_cli.cli import build_parser
from lifeos_cli.config import clear_config_cache
from tests.config_support import install_test_config


def test_web_command_is_registered() -> None:
    parser = build_parser()

    args = parser.parse_args(["web", "serve", "--port", "9876"])

    assert args.resource == "web"
    assert args.web_command == "serve"
    assert args.port == 9876


def test_web_app_registers_core_resource_routes() -> None:
    pytest.importorskip("fastapi")
    from lifeos_web.app import app

    route_paths = {getattr(route, "path", None) for route in app.routes}

    assert "/api/v1/tasks/" in route_paths
    assert "/api/v1/timelogs/" in route_paths
    assert "/api/v1/notes/" in route_paths
    assert "/api/v1/visions/" in route_paths
    assert "/api/v1/habits/" in route_paths
    assert "/api/v1/habits/habit-task-associations/" in route_paths
    assert "/api/v1/persons/" in route_paths


def test_web_server_preflights_configured_database_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("fastapi")
    from lifeos_web import server

    checked_urls: list[str] = []

    monkeypatch.setattr(
        server,
        "get_database_settings",
        lambda: SimpleNamespace(
            require_database_url=lambda: "postgresql+psycopg://localhost/lifeos"
        ),
    )
    monkeypatch.setattr(server, "ensure_database_driver_available", checked_urls.append)
    monkeypatch.setattr(server, "ensure_database_url_storage_ready", lambda _url: None)

    server.preflight_database_runtime()

    assert checked_urls == ["postgresql+psycopg://localhost/lifeos"]


def test_web_timezone_preference_persists_to_cli_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.preferences import PreferenceUpdate, get_preference, set_preference

    config_path = install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        timezone="UTC",
    )
    monkeypatch.delenv("LIFEOS_TIMEZONE", raising=False)
    clear_config_cache()

    initial = asyncio.run(get_preference("system.timezone"))
    assert initial["value"] == "UTC"

    updated = asyncio.run(
        set_preference(
            "system.timezone",
            PreferenceUpdate(value="America/Toronto", module="system"),
        )
    )
    assert updated["value"] == "America/Toronto"

    reloaded = asyncio.run(get_preference("system.timezone"))
    assert reloaded["value"] == "America/Toronto"
    assert "LIFEOS_TIMEZONE" not in os.environ

    assert 'timezone = "America/Toronto"' in config_path.read_text(encoding="utf-8")


def test_web_timezone_preference_converges_env_override_to_cli_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.preferences import get_preference

    config_path = install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        timezone="UTC",
    )
    monkeypatch.setenv("LIFEOS_TIMEZONE", "America/New_York")
    clear_config_cache()

    current = asyncio.run(get_preference("system.timezone"))

    assert current["value"] == "America/New_York"
    assert 'timezone = "America/New_York"' in config_path.read_text(encoding="utf-8")


def test_web_timezone_preference_updates_process_env_override(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.preferences import PreferenceUpdate, get_preference, set_preference

    config_path = install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        timezone="UTC",
    )
    monkeypatch.setenv("LIFEOS_TIMEZONE", "America/New_York")
    clear_config_cache()

    updated = asyncio.run(
        set_preference(
            "system.timezone",
            PreferenceUpdate(value="America/Toronto", module="system"),
        )
    )
    reloaded = asyncio.run(get_preference("system.timezone"))

    assert updated["value"] == "America/Toronto"
    assert reloaded["value"] == "America/Toronto"
    assert os.environ["LIFEOS_TIMEZONE"] == "America/Toronto"
    assert 'timezone = "America/Toronto"' in config_path.read_text(encoding="utf-8")


def test_web_vision_experience_preference_persists_to_cli_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.preferences import PreferenceUpdate, get_preference, set_preference

    config_path = install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        vision_experience_rate_per_hour=60,
    )

    updated = asyncio.run(
        set_preference(
            "visions.experience_rate_per_hour",
            PreferenceUpdate(value=120, module="visions"),
        )
    )
    assert updated["value"] == 120

    reloaded = asyncio.run(get_preference("visions.experience_rate_per_hour"))
    assert reloaded["value"] == 120

    assert "vision_experience_rate_per_hour = 120" in config_path.read_text(encoding="utf-8")
