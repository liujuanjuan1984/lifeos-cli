from __future__ import annotations

import asyncio
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.cli import build_parser
from lifeos_cli.config import clear_config_cache
from lifeos_cli.db.services.read_models import (
    EventView,
    NoteView,
    PersonSummaryView,
    TagSummaryView,
    TagView,
    TaskSummaryView,
    TimelogTemplateView,
    TimelogView,
)
from lifeos_cli.db.services.timelog_support import (
    TimelogBatchUpdateInput,
    TimelogListInput,
    TimelogQueryFilters,
)
from tests.config_support import install_test_config


class CachedEngineSentinel:
    async def dispose(self) -> None:
        raise AssertionError("Web preference writes must not dispose the cached database engine")


def test_web_command_is_registered() -> None:
    parser = build_parser()

    args = parser.parse_args(["web", "serve", "--port", "9876"])

    assert args.resource == "web"
    assert args.web_command == "serve"
    assert args.port == 9876


def test_web_finance_decimal_serialization_avoids_scientific_zero() -> None:
    pytest.importorskip("fastapi")
    from lifeos_web.routers.finance import _asset_decimal_str, _decimal_str

    assert _decimal_str(Decimal("0E-8")) == "0.00000000"
    assert _decimal_str(Decimal("1250.50000000")) == "1250.50000000"
    assert (
        _asset_decimal_str(
            Decimal("37916.37000000"),
            currency_code="CNY",
            decimal_places_by_code={"CNY": 2},
        )
        == "37916.37"
    )
    assert (
        _asset_decimal_str(
            Decimal("0E-8"),
            currency_code="BTC",
            decimal_places_by_code={"BTC": 8},
        )
        == "0.00000000"
    )


def test_planned_event_recurrence_until_accepts_utc_z_suffix() -> None:
    pytest.importorskip("fastapi")
    from lifeos_web.routers.planned_events import _create_input
    from lifeos_web.schemas import PlannedEventCreate

    payload = PlannedEventCreate(
        title="Daily focus",
        start_time=datetime(2026, 6, 16, 16, 0, tzinfo=timezone.utc),
        is_recurring=True,
        recurrence_pattern={
            "frequency": "daily",
            "until": "2026-06-20T16:00:00.000Z",
        },
    )

    parsed = _create_input(payload)

    assert parsed.recurrence_until is not None
    assert parsed.recurrence_until.isoformat() == "2026-06-20T16:00:00+00:00"


def test_planned_event_rrule_preserves_advanced_recurrence_details() -> None:
    pytest.importorskip("fastapi")
    from lifeos_web.routers.planned_events import _create_input, _planned_event_payload
    from lifeos_web.schemas import PlannedEventCreate

    payload = PlannedEventCreate(
        title="Second Monday review",
        start_time=datetime(2026, 4, 13, 16, 0, tzinfo=timezone.utc),
        is_recurring=True,
        rrule_string="FREQ=MONTHLY;BYDAY=2MO;BYMONTH=4,5",
    )

    parsed = _create_input(payload)

    assert parsed.recurrence_frequency == "monthly"
    assert parsed.recurrence_rule == {
        "bymonth": [4, 5],
        "byweekday_ordinals": [{"weekday": "monday", "ordinal": 2}],
    }

    event_payload = _planned_event_payload(
        EventView(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Second Monday review",
            description=None,
            status="planned",
            event_type="appointment",
            priority=0,
            is_all_day=False,
            start_time=datetime(2026, 4, 13, 16, 0, tzinfo=timezone.utc),
            end_time=None,
            recurrence_frequency="monthly",
            recurrence_interval=1,
            recurrence_count=None,
            recurrence_until=None,
            recurrence_rule={
                "bymonth": [4, 5],
                "byweekday_ordinals": [{"weekday": "monday", "ordinal": 2}],
            },
            recurrence_parent_event_id=None,
            recurrence_instance_start=None,
            area_id=None,
            task_id=None,
            created_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
            updated_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
            deleted_at=None,
        )
    )

    assert event_payload["recurrence_pattern"] == {
        "frequency": "monthly",
        "interval": 1,
        "count": None,
        "until": None,
        "bymonth": [4, 5],
        "byweekday_ordinals": [{"weekday": "monday", "ordinal": 2}],
    }
    assert event_payload["rrule_string"] == "FREQ=MONTHLY;BYDAY=2MO;BYMONTH=4,5"


def test_planned_event_create_ignores_rrule_when_not_recurring() -> None:
    pytest.importorskip("fastapi")
    from lifeos_web.routers.planned_events import _create_input
    from lifeos_web.schemas import PlannedEventCreate

    payload = PlannedEventCreate(
        title="One-off review",
        start_time=datetime(2026, 4, 13, 16, 0, tzinfo=timezone.utc),
        is_recurring=False,
        rrule_string="FREQ=MONTHLY;BYDAY=2MO",
    )

    parsed = _create_input(payload)

    assert parsed.recurrence_frequency is None
    assert parsed.recurrence_rule is None


def test_web_app_registers_core_resource_routes() -> None:
    pytest.importorskip("fastapi")
    from lifeos_web.app import app

    route_paths: set[str] = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        if path is not None:
            route_paths.add(path)
            continue
        include_context = getattr(route, "include_context", None)
        original_router = getattr(route, "original_router", None)
        if include_context is None or original_router is None:
            continue
        prefix = getattr(include_context, "prefix", "") or ""
        route_paths.update(
            f"{prefix}{child.path}"
            for child in original_router.routes
            if getattr(child, "path", None) is not None
        )

    assert "/api/v1/tasks/" in route_paths
    assert "/api/v1/timelogs/" in route_paths
    assert "/api/v1/timelogs/templates/" in route_paths
    assert "/api/v1/notes/" in route_paths
    assert "/api/v1/visions/" in route_paths
    assert "/api/v1/habits/" in route_paths
    assert "/api/v1/habits/habit-task-associations/" in route_paths
    assert "/api/v1/persons/" in route_paths
    assert "/api/v1/tags/" in route_paths
    assert "/api/v1/finance/trees" in route_paths


def test_web_tasks_list_uses_count_for_pagination_and_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import tasks as task_router

    captured: dict[str, object] = {}

    async def fake_list_tasks(_session: object, **kwargs: object) -> list[object]:
        captured["list_kwargs"] = kwargs
        return [
            SimpleNamespace(
                id=UUID("11111111-1111-1111-1111-111111111111"),
                vision_id=UUID("22222222-2222-2222-2222-222222222222"),
                parent_task_id=None,
                content="Needle task",
                status="todo",
            )
        ]

    async def fake_count_tasks(_session: object, **kwargs: object) -> int:
        captured["count_kwargs"] = kwargs
        return 123

    monkeypatch.setattr(task_router.task_services, "list_tasks", fake_list_tasks)
    monkeypatch.setattr(task_router.task_services, "count_tasks", fake_count_tasks)

    response = asyncio.run(
        task_router.list_tasks(
            cast(AsyncSession, object()),
            page=2,
            size=50,
            query="Needle",
        )
    )

    assert captured["list_kwargs"] == {
        "vision_id": None,
        "vision_in": None,
        "status": None,
        "status_in": None,
        "exclude_status": None,
        "planning_cycle_type": None,
        "planning_cycle_start_date": None,
        "query": "Needle",
        "limit": 50,
        "offset": 50,
    }
    assert captured["count_kwargs"] == {
        "vision_id": None,
        "vision_in": None,
        "status": None,
        "status_in": None,
        "exclude_status": None,
        "planning_cycle_type": None,
        "planning_cycle_start_date": None,
        "query": "Needle",
    }
    assert response.pagination.total == 123
    assert response.pagination.pages == 3
    assert response.meta["query"] == "Needle"


def test_web_tasks_reorder_route_precedes_task_id_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import tasks as task_router
    from lifeos_web.schemas import TaskReorderItem, TaskReorderRequest

    captured: dict[str, object] = {}

    async def fake_reorder_tasks(_session: object, **kwargs: object) -> None:
        captured["task_orders"] = kwargs["task_orders"]

    monkeypatch.setattr(task_router.task_services, "reorder_tasks", fake_reorder_tasks)

    task_route_paths = [getattr(route, "path", None) for route in task_router.router.routes]

    task_one_id = "11111111-1111-1111-1111-111111111111"
    task_two_id = "22222222-2222-2222-2222-222222222222"

    assert task_route_paths.index("/tasks/reorder") < task_route_paths.index("/tasks/{task_id}")

    asyncio.run(
        task_router.reorder_tasks(
            TaskReorderRequest(
                task_orders=[
                    TaskReorderItem(id=UUID(task_two_id), display_order=0),
                    TaskReorderItem(id=UUID(task_one_id), display_order=1),
                ],
            ),
            cast(AsyncSession, object()),
        )
    )

    assert captured["task_orders"] == [
        (UUID(task_two_id), 0),
        (UUID(task_one_id), 1),
    ]


def test_web_static_assets_disable_cache(tmp_path: Path) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.app import SPAStaticFiles

    static_dir = tmp_path / "static"
    assets_dir = static_dir / "assets"
    assets_dir.mkdir(parents=True)
    (static_dir / "index.html").write_text("<html>LifeOS</html>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('lifeos')", encoding="utf-8")

    static_files = SPAStaticFiles(directory=static_dir, html=True)
    scope = {"type": "http", "method": "GET", "headers": []}

    asset_response = asyncio.run(static_files.get_response("assets/app.js", scope))
    spa_response = asyncio.run(static_files.get_response("timelog", scope))

    assert asset_response.status_code == 200
    assert asset_response.headers["cache-control"] == "no-store"
    assert spa_response.status_code == 200
    assert spa_response.headers["cache-control"] == "no-store"

    for reserved_path in ("api/v1/missing", "health/missing", "assets/missing"):
        route_error: object | None = None
        try:
            asyncio.run(static_files.get_response(reserved_path, scope))
        except Exception as exc:
            route_error = exc
        else:
            pytest.fail(f"{reserved_path} should not fall back to SPA index.html")

        assert getattr(route_error, "status_code", None) == 404


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


def test_web_timelog_without_area_filter_maps_to_lifeos_without_area(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs

    captured: dict[str, TimelogListInput | TimelogQueryFilters] = {}

    async def fake_count_timelogs(_session: object, *, filters: TimelogQueryFilters) -> int:
        captured["count_filters"] = filters
        return 0

    async def fake_list_timelogs(_session: object, *, query: TimelogListInput) -> list[object]:
        captured["list_query"] = query
        return []

    monkeypatch.setattr(
        timelogs.timelog_services,
        "count_timelogs",
        fake_count_timelogs,
    )
    monkeypatch.setattr(
        timelogs.timelog_services,
        "list_timelogs",
        fake_list_timelogs,
    )

    response = asyncio.run(
        timelogs.list_timelogs(
            cast(AsyncSession, object()),
            page=1,
            size=50,
            without_area=True,
        )
    )

    count_filters = captured["count_filters"]
    list_query = captured["list_query"]
    assert isinstance(count_filters, TimelogQueryFilters)
    assert isinstance(list_query, TimelogListInput)
    assert count_filters.without_area is True
    assert list_query.filters.without_area is True
    assert response.meta["without_area"] is True


def test_web_timelog_template_list_maps_pagination_and_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelog_templates

    captured: dict[str, object] = {}

    async def fake_count_templates(_session: object) -> int:
        return 12

    async def fake_list_templates(_session: object, *, query: object) -> list[object]:
        captured["query"] = query
        return []

    monkeypatch.setattr(
        timelog_templates.template_services,
        "count_templates",
        fake_count_templates,
    )
    monkeypatch.setattr(
        timelog_templates.template_services,
        "list_templates",
        fake_list_templates,
    )

    response = asyncio.run(
        timelog_templates.list_timelog_templates(
            cast(AsyncSession, object()),
            page=2,
            size=5,
            order_by="usage",
        )
    )

    query = captured["query"]
    assert isinstance(query, timelog_templates.template_services.TimelogTemplateListInput)
    assert query.limit == 5
    assert query.offset == 5
    assert query.order_by == "usage"
    assert response.pagination.total == 12
    assert response.pagination.pages == 3
    assert response.meta["order_by"] == "usage"


def test_web_timelog_template_update_preserves_explicit_nulls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelog_templates
    from lifeos_web.schemas import TimelogTemplateUpdate

    template_id = UUID("11111111-1111-1111-1111-111111111111")
    captured: dict[str, object] = {}

    async def fake_update_template(_session: object, **kwargs: object) -> TimelogTemplateView:
        captured.update(kwargs)
        return TimelogTemplateView(
            id=template_id,
            title="Focus",
            area_id=None,
            area_name=None,
            area_color=None,
            person_ids=(),
            people=(PersonSummaryView(id=UUID("22222222-2222-2222-2222-222222222222"), name="A"),),
            default_duration_minutes=None,
            position=0,
            usage_count=0,
            last_used_at=None,
            created_at=datetime(2026, 6, 17, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 17, tzinfo=timezone.utc),
            deleted_at=None,
        )

    monkeypatch.setattr(
        timelog_templates.template_services,
        "update_template",
        fake_update_template,
    )

    response = asyncio.run(
        timelog_templates.update_timelog_template(
            template_id,
            TimelogTemplateUpdate(
                title=None,
                area_id=None,
                default_duration_minutes=None,
                position=None,
                usage_count=None,
            ),
            cast(AsyncSession, object()),
        )
    )

    changes = captured["changes"]
    assert isinstance(changes, timelog_templates.template_services.TimelogTemplateUpdateInput)
    assert changes.area_provided is True
    assert changes.area_id is None
    assert changes.default_duration_minutes_provided is True
    assert changes.default_duration_minutes is None
    assert changes.person_ids_provided is False
    assert response["people"] == [
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "name": "A",
            "display_name": "A",
            "primary_nickname": "A",
            "tags": [],
        }
    ]


def test_web_timelog_without_task_filter_maps_to_lifeos_without_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs

    captured: dict[str, TimelogListInput | TimelogQueryFilters] = {}

    async def fake_count_timelogs(_session: object, *, filters: TimelogQueryFilters) -> int:
        captured["count_filters"] = filters
        return 0

    async def fake_list_timelogs(_session: object, *, query: TimelogListInput) -> list[object]:
        captured["list_query"] = query
        return []

    monkeypatch.setattr(
        timelogs.timelog_services,
        "count_timelogs",
        fake_count_timelogs,
    )
    monkeypatch.setattr(
        timelogs.timelog_services,
        "list_timelogs",
        fake_list_timelogs,
    )

    response = asyncio.run(
        timelogs.list_timelogs(
            cast(AsyncSession, object()),
            page=1,
            size=50,
            without_task=True,
        )
    )

    count_filters = captured["count_filters"]
    list_query = captured["list_query"]
    assert isinstance(count_filters, TimelogQueryFilters)
    assert isinstance(list_query, TimelogListInput)
    assert count_filters.without_task is True
    assert list_query.filters.without_task is True
    assert response.meta["without_task"] is True


def test_web_timelog_window_filters_map_to_lifeos_window_filters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs

    captured: dict[str, TimelogListInput | TimelogQueryFilters] = {}

    async def fake_count_timelogs(_session: object, *, filters: TimelogQueryFilters) -> int:
        captured["count_filters"] = filters
        return 0

    async def fake_list_timelogs(_session: object, *, query: TimelogListInput) -> list[object]:
        captured["list_query"] = query
        return []

    monkeypatch.setattr(
        timelogs.timelog_services,
        "count_timelogs",
        fake_count_timelogs,
    )
    monkeypatch.setattr(
        timelogs.timelog_services,
        "list_timelogs",
        fake_list_timelogs,
    )

    window_start = datetime(2026, 4, 10, 16, 0, tzinfo=timezone.utc)
    window_end = datetime(2026, 4, 11, 15, 59, 59, 999000, tzinfo=timezone.utc)

    response = asyncio.run(
        timelogs.list_timelogs(
            cast(AsyncSession, object()),
            page=1,
            size=50,
            window_start=window_start,
            window_end=window_end,
        )
    )

    count_filters = captured["count_filters"]
    list_query = captured["list_query"]
    assert isinstance(count_filters, TimelogQueryFilters)
    assert isinstance(list_query, TimelogListInput)
    assert count_filters.start_date is None
    assert count_filters.end_date is None
    assert count_filters.window_start == window_start
    assert count_filters.window_end == window_end
    assert list_query.filters.window_start == window_start
    assert list_query.filters.window_end == window_end
    assert response.meta["window_start"] == window_start.isoformat()
    assert response.meta["window_end"] == window_end.isoformat()


def test_web_timelog_rejects_mixed_date_and_window_filters() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs

    with pytest.raises(Exception) as exc_info:
        asyncio.run(
            timelogs.list_timelogs(
                cast(AsyncSession, object()),
                start_date=date(2026, 4, 10),
                end_date=date(2026, 4, 10),
                window_start=datetime(2026, 4, 10, 16, 0, tzinfo=timezone.utc),
            )
        )

    assert getattr(exc_info.value, "status_code", None) == 400
    assert "Use either start_date/end_date or window_start/window_end" in str(
        getattr(exc_info.value, "detail", "")
    )


def test_web_timelog_rejects_task_id_with_without_task() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs

    with pytest.raises(Exception) as exc_info:
        asyncio.run(
            timelogs.list_timelogs(
                cast(AsyncSession, object()),
                task_id=UUID("11111111-1111-1111-1111-111111111111"),
                without_task=True,
            )
        )

    assert getattr(exc_info.value, "status_code", None) == 400
    assert "Use either task_id or without_task" in str(getattr(exc_info.value, "detail", ""))


def test_web_timelog_rejects_partial_date_filter() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs

    with pytest.raises(Exception) as exc_info:
        asyncio.run(
            timelogs.list_timelogs(
                cast(AsyncSession, object()),
                start_date=date(2026, 4, 10),
            )
        )

    assert getattr(exc_info.value, "status_code", None) == 400
    assert "start_date and end_date must be provided together" in str(
        getattr(exc_info.value, "detail", "")
    )


def test_web_timelog_payload_exposes_linked_task_summary() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.timelogs import _timelog_payload

    task_id = UUID("22222222-2222-2222-2222-222222222222")
    payload = _timelog_payload(
        TimelogView(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            title="Focused work",
            tracking_method="manual",
            start_time=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 6, 1, 14, 0, tzinfo=timezone.utc),
            location=None,
            energy_level=None,
            notes=None,
            area_id=None,
            task_id=task_id,
            created_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            deleted_at=None,
            linked_notes_count=0,
            task=TaskSummaryView(
                id=task_id,
                vision_id=UUID("33333333-3333-3333-3333-333333333333"),
                parent_task_id=None,
                content="Ship web timelog task linkage",
                status="in_progress",
            ),
        )
    )

    assert payload["task_id"] == str(task_id)
    assert payload["task"] == {
        "id": str(task_id),
        "vision_id": "33333333-3333-3333-3333-333333333333",
        "parent_task_id": None,
        "content": "Ship web timelog task linkage",
        "status": "in_progress",
    }


def test_web_timelog_payload_serializes_naive_storage_datetimes_as_utc() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.timelogs import _timelog_payload

    payload = _timelog_payload(
        TimelogView(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            title="SQLite-backed work",
            tracking_method="manual",
            start_time=datetime(2026, 6, 13, 21, 0),
            end_time=datetime(2026, 6, 13, 21, 5),
            location=None,
            energy_level=None,
            notes=None,
            area_id=None,
            task_id=None,
            created_at=datetime(2026, 6, 13, 21, 9, 24),
            updated_at=datetime(2026, 6, 13, 21, 9, 24),
            deleted_at=None,
            linked_notes_count=0,
            task=None,
        )
    )

    assert payload["start_time"] == "2026-06-13T21:00:00Z"
    assert payload["end_time"] == "2026-06-13T21:05:00Z"
    assert payload["created_at"] == "2026-06-13T21:09:24Z"


def test_web_task_update_null_planning_cycle_translates_to_clear_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import tasks
    from lifeos_web.schemas import TaskUpdate

    captured: dict[str, object] = {}

    async def fake_update_task(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(tasks.task_services, "update_task", fake_update_task)

    asyncio.run(
        tasks.update_task(
            UUID("55555555-5555-5555-5555-555555555555"),
            TaskUpdate(
                planning_cycle_type=None,
                planning_cycle_days=None,
                planning_cycle_start_date=None,
            ),
            cast(AsyncSession, object()),
        )
    )

    assert captured["clear_planning_cycle"] is True
    assert captured["planning_cycle_type"] is None
    assert captured["planning_cycle_days"] is None
    assert captured["planning_cycle_start_date"] is None


def test_web_task_update_null_parent_and_estimated_effort_translate_to_clear_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import tasks
    from lifeos_web.schemas import TaskUpdate

    captured: dict[str, object] = {}

    async def fake_update_task(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(tasks.task_services, "update_task", fake_update_task)

    asyncio.run(
        tasks.update_task(
            UUID("55555555-5555-5555-5555-555555555555"),
            TaskUpdate(parent_task_id=None, estimated_effort=None),
            cast(AsyncSession, object()),
        )
    )

    assert captured["clear_parent"] is True
    assert captured["clear_estimated_effort"] is True


def test_web_vision_update_null_description_and_experience_clear_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import visions
    from lifeos_web.schemas import VisionUpdate

    captured: dict[str, object] = {}

    async def fake_update_vision(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(visions.vision_services, "update_vision", fake_update_vision)

    asyncio.run(
        visions.update_vision(
            UUID("55555555-5555-5555-5555-555555555555"),
            VisionUpdate(description=None, experience_rate_per_hour=None),
            cast(AsyncSession, object()),
        )
    )

    assert captured["clear_description"] is True
    assert captured["clear_experience_rate"] is True
    assert captured["clear_area"] is False


def test_web_vision_update_area_id_passes_through(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import visions
    from lifeos_web.schemas import VisionUpdate

    area_id = UUID("11111111-1111-1111-1111-111111111111")
    person_id = UUID("33333333-3333-3333-3333-333333333333")
    captured: dict[str, object] = {}

    async def fake_update_vision(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            name="Vision",
            description=None,
            status="active",
            stage=0,
            experience_points=0,
            experience_rate_per_hour=None,
            area_id=area_id,
            created_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            deleted_at=None,
            people=(),
            tasks=(),
        )

    monkeypatch.setattr(visions.vision_services, "update_vision", fake_update_vision)

    response = asyncio.run(
        visions.update_vision(
            UUID("55555555-5555-5555-5555-555555555555"),
            VisionUpdate(area_id=area_id, person_ids=[person_id]),
            cast(AsyncSession, object()),
        )
    )

    assert captured["area_id"] == area_id
    assert captured["clear_area"] is False
    assert captured["person_ids"] == [person_id]
    assert captured["clear_people"] is False
    assert response["area_id"] == str(area_id)
    assert set(response).issuperset({"id", "name", "area_id"})


def test_web_habit_update_null_fields_translate_to_clear_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import habits
    from lifeos_web.schemas import HabitUpdate

    captured: dict[str, object] = {}

    async def fake_update_habit(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(habits.habit_services, "update_habit", fake_update_habit)
    monkeypatch.setattr(
        habits,
        "_habit_model_payload",
        lambda habit: {"id": str(habit.id)},
    )

    asyncio.run(
        habits.update_habit(
            UUID("55555555-5555-5555-5555-555555555555"),
            HabitUpdate(
                description=None,
                duration_days=None,
                cadence_weekdays=None,
                task_id=None,
            ),
            cast(AsyncSession, object()),
        )
    )

    assert captured["clear_description"] is True
    assert captured["clear_weekdays"] is True
    assert captured["clear_task"] is True


def test_web_habit_action_update_null_notes_maps_to_clear_notes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import habits
    from lifeos_web.schemas import HabitActionUpdate

    captured: dict[str, object] = {}

    async def fake_update_habit_action(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(
            id=UUID("22222222-2222-2222-2222-222222222222"),
        )

    monkeypatch.setattr(
        habits.habit_action_services, "update_habit_action", fake_update_habit_action
    )

    async def fake_action_with_habit(_session: object, action: Any) -> dict[str, str]:
        return {"id": str(action.id)}

    monkeypatch.setattr(habits, "_action_with_habit", fake_action_with_habit)

    asyncio.run(
        habits.update_action(
            UUID("66666666-6666-6666-6666-666666666666"),
            UUID("77777777-7777-7777-7777-777777777777"),
            HabitActionUpdate(notes=None),
            cast(AsyncSession, object()),
        )
    )

    assert captured["clear_notes"] is True


def test_web_habit_action_by_date_update_null_notes_maps_to_clear_notes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import habits
    from lifeos_web.schemas import HabitActionUpdate

    captured: dict[str, object] = {}

    async def fake_update_habit_action_by_date(
        _session: object,
        **kwargs: object,
    ) -> object:
        captured.update(kwargs)
        return SimpleNamespace(
            id=UUID("22222222-2222-2222-2222-222222222222"),
        )

    monkeypatch.setattr(
        habits.habit_action_services,
        "update_habit_action_by_date",
        fake_update_habit_action_by_date,
    )

    async def fake_action_with_habit(_session: object, action: Any) -> dict[str, str]:
        return {"id": str(action.id)}

    monkeypatch.setattr(habits, "_action_with_habit", fake_action_with_habit)

    asyncio.run(
        habits.update_action_by_date(
            UUID("55555555-5555-5555-5555-555555555555"),
            datetime(2026, 6, 1, tzinfo=timezone.utc).date(),
            HabitActionUpdate(notes=None),
            cast(AsyncSession, object()),
        )
    )

    assert captured["clear_notes"] is True


def test_web_timelog_update_null_fields_translate_to_clear_flags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_cli.db.services.timelog_support import TimelogUpdateInput
    from lifeos_web.routers import timelogs
    from lifeos_web.schemas import TimelogUpdate

    captured_changes: TimelogUpdateInput | None = None

    async def fake_update_timelog(
        _session: object,
        *,
        changes: TimelogUpdateInput,
        **_kwargs: object,
    ) -> object:
        nonlocal captured_changes
        captured_changes = changes
        return {
            "title": "work",
            "tracking_method": "manual",
            "start_time": datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            "end_time": datetime(2026, 6, 1, 14, 0, tzinfo=timezone.utc),
            "location": None,
            "energy_level": None,
            "notes": None,
            "area_id": None,
            "task_id": None,
            "person_ids": [],
            "tag_ids": [],
            "created_at": datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            "deleted_at": None,
        }

    monkeypatch.setattr(timelogs.timelog_services, "update_timelog", fake_update_timelog)

    asyncio.run(
        timelogs.update_timelog(
            UUID("55555555-5555-5555-5555-555555555555"),
            TimelogUpdate(
                location=None,
                energy_level=None,
                notes=None,
                area_id=None,
                task_id=None,
                person_ids=[],
            ),
            cast(AsyncSession, object()),
        )
    )

    assert captured_changes is not None
    assert captured_changes.clear_location is True
    assert captured_changes.clear_energy_level is True
    assert captured_changes.clear_notes is True
    assert captured_changes.clear_area is True
    assert captured_changes.clear_task is True
    assert captured_changes.clear_people is True


def test_web_timelog_batch_task_replace_maps_to_lifeos_task_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import timelogs
    from lifeos_web.schemas import TimelogBatchTaskUpdate, TimelogBatchUpdate

    task_id = UUID("22222222-2222-2222-2222-222222222222")
    timelog_id = UUID("11111111-1111-1111-1111-111111111111")
    captured: dict[str, TimelogBatchUpdateInput] = {}

    async def fake_batch_update_timelogs(
        _session: object,
        *,
        timelog_ids: list[UUID],
        changes: TimelogBatchUpdateInput,
    ) -> object:
        assert timelog_ids == [timelog_id]
        captured["changes"] = changes
        return SimpleNamespace(
            updated_count=1,
            unchanged_ids=(),
            failed_ids=(),
            errors=(),
        )

    monkeypatch.setattr(
        timelogs.timelog_services,
        "batch_update_timelogs",
        fake_batch_update_timelogs,
    )

    response = asyncio.run(
        timelogs.batch_update_timelogs(
            TimelogBatchUpdate(
                timelog_ids=[timelog_id],
                update_type="task",
                task=TimelogBatchTaskUpdate(mode="replace", task_id=task_id),
            ),
            cast(AsyncSession, object()),
        )
    )

    changes = captured["changes"].changes
    assert changes.task_id == task_id
    assert changes.clear_task is False
    assert response["updated_count"] == 1


def test_web_tag_create_maps_to_lifeos_tag_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import tags
    from lifeos_web.schemas import TagCreate

    captured: dict[str, object] = {}

    async def fake_create_tag(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return TagView(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            name="project",
            entity_type="note",
            category="general",
            description=None,
            color=None,
            created_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            deleted_at=None,
            people=(),
        )

    monkeypatch.setattr(tags.tag_services, "create_tag", fake_create_tag)

    response = asyncio.run(
        tags.create_tag(
            TagCreate(name="Project", entity_type="note", category="general"),
            cast(AsyncSession, object()),
        )
    )

    assert captured == {
        "name": "Project",
        "entity_type": "note",
        "category": "general",
        "description": None,
        "color": None,
    }
    assert response["id"] == "11111111-1111-1111-1111-111111111111"
    assert response["name"] == "project"


def test_web_note_create_maps_selector_associations_to_lifeos_note_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers import notes
    from lifeos_web.schemas import NoteCreate

    tag_id = UUID("11111111-1111-1111-1111-111111111111")
    person_id = UUID("22222222-2222-2222-2222-222222222222")
    task_id = UUID("33333333-3333-3333-3333-333333333333")
    timelog_id = UUID("44444444-4444-4444-4444-444444444444")
    captured: dict[str, object] = {}

    async def fake_create_note(_session: object, **kwargs: object) -> object:
        captured.update(kwargs)
        return SimpleNamespace(
            id=UUID("55555555-5555-5555-5555-555555555555"),
            content=kwargs["content"],
            created_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
            deleted_at=None,
            tags=(),
            people=(),
            tasks=(),
            visions=(),
            events=(),
            timelogs=(),
        )

    monkeypatch.setattr(notes.note_services, "create_note", fake_create_note)

    asyncio.run(
        notes.create_note(
            NoteCreate(
                content="Capture context",
                tag_ids=[tag_id],
                person_ids=[person_id],
                task_id=task_id,
                timelog_ids=[timelog_id],
            ),
            cast(AsyncSession, object()),
        )
    )

    assert captured == {
        "content": "Capture context",
        "tag_ids": [tag_id],
        "person_ids": [person_id],
        "task_ids": [task_id],
        "timelog_ids": [timelog_id],
    }


def test_web_note_payload_exposes_primary_task_for_notes_page() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.notes import _note_payload

    task = TaskSummaryView(
        id=UUID("33333333-3333-3333-3333-333333333333"),
        vision_id=UUID("44444444-4444-4444-4444-444444444444"),
        parent_task_id=None,
        content="Investigate note association",
        status="todo",
    )
    tag = TagSummaryView(
        id=UUID("66666666-6666-6666-6666-666666666666"),
        name="research",
    )
    person = PersonSummaryView(
        id=UUID("77777777-7777-7777-7777-777777777777"),
        name="Alice",
    )
    note = NoteView(
        id=UUID("55555555-5555-5555-5555-555555555555"),
        content="Capture context",
        created_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
        deleted_at=None,
        tags=(tag,),
        people=(person,),
        tasks=(task,),
    )

    payload = _note_payload(note)

    assert payload["tasks"] == [
        {
            "id": str(task.id),
            "vision_id": str(task.vision_id),
            "parent_task_id": None,
            "content": "Investigate note association",
            "status": "todo",
        }
    ]
    assert payload["task"] == payload["tasks"][0]
    assert payload["tags"] == [
        {
            "id": str(tag.id),
            "name": "research",
            "entity_type": "note",
            "category": "general",
            "description": None,
            "color": None,
            "created_at": "",
            "updated_at": "",
        }
    ]
    assert payload["people"] == [
        {
            "id": str(person.id),
            "name": "Alice",
            "display_name": "Alice",
            "primary_nickname": "Alice",
            "birth_date": None,
            "location": None,
            "tags": [],
        }
    ]
    assert "persons" not in payload


def test_web_note_payload_uses_null_primary_task_without_association() -> None:
    pytest.importorskip("fastapi")

    from lifeos_web.routers.notes import _note_payload

    note = NoteView(
        id=UUID("55555555-5555-5555-5555-555555555555"),
        content="Capture context",
        created_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 1, 13, 0, tzinfo=timezone.utc),
        deleted_at=None,
    )

    payload = _note_payload(note)

    assert payload["tasks"] == []
    assert payload["task"] is None
    assert payload["people"] == []
    assert "persons" not in payload
    assert payload["tags"] == []


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

    from lifeos_cli.db import session as db_session
    from lifeos_web.routers.preferences import get_preference

    config_path = install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        timezone="UTC",
    )
    monkeypatch.setenv("LIFEOS_TIMEZONE", "America/New_York")
    monkeypatch.setattr(db_session, "_CACHED_ENGINE", CachedEngineSentinel())
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


def test_web_theme_preference_persists_to_cli_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    pytest.importorskip("fastapi")

    from lifeos_cli.db import session as db_session
    from lifeos_web.routers.preferences import PreferenceUpdate, get_preference, set_preference

    config_path = install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_preferences=True,
        theme="system",
    )
    monkeypatch.setattr(db_session, "_CACHED_ENGINE", CachedEngineSentinel())

    updated = asyncio.run(
        set_preference(
            "appearance.theme",
            PreferenceUpdate(value="night", module="appearance"),
        )
    )
    assert updated["value"] == "night"

    clear_config_cache()
    reloaded = asyncio.run(get_preference("appearance.theme"))
    assert reloaded["value"] == "night"

    assert 'theme = "night"' in config_path.read_text(encoding="utf-8")
