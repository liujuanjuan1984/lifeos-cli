"""Backend capability and behavior policy helpers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ReplaceExistingStrategy = Literal["truncate_cascade", "delete_sorted_tables"]


@dataclass(frozen=True)
class DatabaseBackendPolicy:
    """Capability and behavior flags for one supported database backend."""

    drivername: str
    backend_name: str
    supports_schema: bool
    supports_local_file_storage: bool
    enable_foreign_keys_on_connect: bool
    replace_existing_strategy: ReplaceExistingStrategy
    required_driver_module: str | None = None
    missing_driver_message: str | None = None

    def runtime_error_guidance(self, details: str) -> str | None:
        """Return one actionable runtime error hint when available."""
        if "no password supplied" in details or "password authentication failed" in details:
            return (
                "Authentication failed. Check the username/password in the database URL, "
                "or update them with `lifeos init`."
            )
        if self.backend_name == "postgresql" and "does not exist" in details:
            return (
                "The configured PostgreSQL database does not exist yet. Create it first, "
                "then run `lifeos db upgrade`."
            )
        if self.backend_name == "postgresql" and (
            "connection refused" in details or "could not connect" in details
        ):
            return (
                "PostgreSQL is not reachable. Ensure the server is installed, running, "
                "and listening on the configured host/port."
            )
        if self.backend_name == "sqlite" and "unable to open database file" in details:
            return (
                "SQLite could not open the configured database file. Ensure the parent "
                "directory exists and is writable."
            )
        return None


_DATABASE_BACKEND_POLICIES: dict[str, DatabaseBackendPolicy] = {
    "postgresql+psycopg": DatabaseBackendPolicy(
        drivername="postgresql+psycopg",
        backend_name="postgresql",
        supports_schema=True,
        supports_local_file_storage=False,
        enable_foreign_keys_on_connect=False,
        replace_existing_strategy="truncate_cascade",
        required_driver_module="psycopg",
        missing_driver_message=(
            "PostgreSQL support is not installed. Install the `postgres` extra, for example: "
            'uv tool install --upgrade "lifeos-cli[postgres]".'
        ),
    ),
    "sqlite+aiosqlite": DatabaseBackendPolicy(
        drivername="sqlite+aiosqlite",
        backend_name="sqlite",
        supports_schema=False,
        supports_local_file_storage=True,
        enable_foreign_keys_on_connect=True,
        replace_existing_strategy="delete_sorted_tables",
    ),
}

SUPPORTED_DATABASE_DRIVERS = frozenset(_DATABASE_BACKEND_POLICIES)


def supported_database_driver_examples() -> str:
    """Render the supported SQLAlchemy driver prefixes for error messages."""
    return ", ".join(f"`{driver}://`" for driver in sorted(SUPPORTED_DATABASE_DRIVERS))


def backend_policy_for_drivername(drivername: str) -> DatabaseBackendPolicy:
    """Return the backend policy for one supported SQLAlchemy drivername."""
    try:
        return _DATABASE_BACKEND_POLICIES[drivername]
    except KeyError as exc:
        raise ValueError(f"Unsupported database drivername: {drivername}") from exc
