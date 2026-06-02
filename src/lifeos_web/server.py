"""Runtime entrypoints for serving LifeOS Web locally."""

from __future__ import annotations

from pathlib import Path

from lifeos_cli.config import (
    ensure_database_driver_available,
    ensure_database_url_storage_ready,
    get_database_settings,
)


def preflight_database_runtime() -> None:
    """Fail before serving HTTP when the configured database runtime is incomplete."""
    database_url = get_database_settings().require_database_url()
    ensure_database_driver_available(database_url)
    ensure_database_url_storage_ready(database_url)


def serve(
    *,
    host: str = "127.0.0.1",
    port: int = 8765,
    reload: bool = False,
    static_dir: Path | None = None,
) -> None:
    """Run the local Web service with uvicorn."""
    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover - exercised by users without [web]
        raise RuntimeError(
            "LifeOS Web dependencies are not installed. Install with `lifeos-cli[web]`."
        ) from exc

    preflight_database_runtime()

    if static_dir is not None:
        from lifeos_web.app import create_app

        uvicorn.run(create_app(static_dir=static_dir), host=host, port=port, reload=reload)
        return

    uvicorn.run("lifeos_web.app:app", host=host, port=port, reload=reload)
