"""Runtime helpers for synchronous CLI entrypoints."""

from __future__ import annotations

import asyncio
import sys
from collections.abc import Coroutine

from sqlalchemy.exc import OperationalError

from lifeos_cli.config import (
    ConfigurationError,
    DatabaseSettings,
    clear_config_cache,
    get_database_settings,
)


def run_async(operation: Coroutine[object, object, int]) -> int:
    """Run an async CLI operation from the synchronous CLI entrypoint."""
    return int(asyncio.run(operation))


def refresh_runtime_configuration() -> None:
    """Clear cached configuration and session state in the current process."""
    clear_config_cache()
    from lifeos_cli.db.session import clear_session_cache

    clear_session_cache()


def format_config_summary(settings: DatabaseSettings, *, show_secrets: bool = False) -> str:
    """Render effective config values for display."""
    lines = [
        f"Config file: {settings.config_file}",
        f"Database URL: {settings.render_database_url(show_secrets=show_secrets)}",
        f"Database schema: {settings.database_schema}",
        f"Database echo: {'true' if settings.database_echo else 'false'}",
    ]
    return "\n".join(lines)


def print_database_runtime_error(exc: BaseException) -> int:
    """Render actionable database configuration or connectivity failures."""
    if isinstance(exc, ConfigurationError):
        print(str(exc), file=sys.stderr)
        return 1

    settings = get_database_settings()
    print("Database operation failed.", file=sys.stderr)
    print(
        f"Configured database URL: {settings.render_database_url(show_secrets=False)}",
        file=sys.stderr,
    )
    print(f"Configured schema: {settings.database_schema}", file=sys.stderr)
    guidance = None
    if isinstance(exc, OperationalError):
        details = str(exc).lower()
        if "no password supplied" in details or "password authentication failed" in details:
            guidance = (
                "Authentication failed. Check the username/password in the database URL, "
                "or update them with `lifeos init`."
            )
        elif "does not exist" in details:
            guidance = (
                "The configured PostgreSQL database does not exist yet. Create it first, "
                "then run `lifeos db upgrade`."
            )
        elif "connection refused" in details or "could not connect" in details:
            guidance = (
                "PostgreSQL is not reachable. Ensure the server is installed, running, "
                "and listening on the configured host/port."
            )
    if guidance is not None:
        print(guidance, file=sys.stderr)
    print("Run `lifeos init` to create or update local configuration.", file=sys.stderr)
    print(
        "Then run `lifeos db ping` to verify connectivity and `lifeos db upgrade` to apply "
        "migrations.",
        file=sys.stderr,
    )
    print(f"Original error: {exc}", file=sys.stderr)
    return 1
