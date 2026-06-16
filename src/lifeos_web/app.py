"""FastAPI application factory for the local LifeOS Web service."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response
from starlette.types import Scope

from lifeos_web.routers import (
    areas,
    habits,
    health,
    notes,
    persons,
    planned_events,
    preferences,
    stats,
    tags,
    tasks,
    timelogs,
    visions,
)

API_PREFIX = "/api/v1"


class SPAStaticFiles(StaticFiles):
    """Serve index.html for client-side application routes."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and "." not in Path(path).name:
                response = await super().get_response("index.html", scope)
            else:
                raise
        response.headers["Cache-Control"] = "no-store"
        return response


def create_app(*, static_dir: Path | None = None) -> FastAPI:
    """Create the local LifeOS Web FastAPI application."""
    app = FastAPI(
        title="LifeOS Web UI",
        version="0.1.0",
        description="Local-first Web API for lifeos-cli data.",
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(tasks.router, prefix=API_PREFIX)
    app.include_router(visions.router, prefix=API_PREFIX)
    app.include_router(habits.router, prefix=API_PREFIX)
    app.include_router(notes.router, prefix=API_PREFIX)
    app.include_router(timelogs.router, prefix=API_PREFIX)
    app.include_router(persons.router, prefix=API_PREFIX)
    app.include_router(areas.router, prefix=API_PREFIX)
    app.include_router(planned_events.router, prefix=API_PREFIX)
    app.include_router(stats.router, prefix=API_PREFIX)
    app.include_router(tags.router, prefix=API_PREFIX)
    app.include_router(preferences.router, prefix=API_PREFIX)

    resolved_static_dir = static_dir or Path(__file__).with_name("static")
    if resolved_static_dir.exists():
        app.mount("/", SPAStaticFiles(directory=resolved_static_dir, html=True), name="static")
    return app


app = create_app()
