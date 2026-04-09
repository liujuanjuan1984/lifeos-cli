"""Runtime configuration for lifeos_cli."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Mapping

_SCHEMA_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class DatabaseSettings:
    """Database settings loaded from environment variables."""

    database_url: str
    database_schema: str
    database_echo: bool

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "DatabaseSettings":
        """Build database settings from the provided environment mapping."""
        source = env or os.environ
        database_url = source.get(
            "LIFEOS_DATABASE_URL",
            "postgresql+psycopg://localhost/lifeos",
        )
        database_schema = source.get("LIFEOS_DATABASE_SCHEMA", "lifeos")
        database_echo = _parse_bool(source.get("LIFEOS_DATABASE_ECHO", "false"))
        cls._validate_schema_name(database_schema)
        return cls(
            database_url=database_url,
            database_schema=database_schema,
            database_echo=database_echo,
        )

    @staticmethod
    def _validate_schema_name(schema_name: str) -> None:
        if not _SCHEMA_NAME_PATTERN.match(schema_name):
            raise ValueError(
                "LIFEOS_DATABASE_SCHEMA must be a valid PostgreSQL schema identifier"
            )


@lru_cache(maxsize=1)
def get_database_settings() -> DatabaseSettings:
    """Return cached database settings for the current process."""
    return DatabaseSettings.from_env()
