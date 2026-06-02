from __future__ import annotations

from types import SimpleNamespace

import pytest

from lifeos_cli.cli import build_parser


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
