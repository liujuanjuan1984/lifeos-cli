"""Runtime configuration for lifeos_cli."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy.engine import make_url

try:
    import tomllib  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 fallback
    import tomli as tomllib

DEFAULT_DATABASE_SCHEMA = "lifeos"
DEFAULT_CONFIG_PATH = Path.home() / ".config" / "lifeos" / "config.toml"
_SCHEMA_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class ConfigurationError(RuntimeError):
    """Raised when runtime configuration is missing or invalid."""


def validate_database_url(database_url: str) -> str:
    """Validate a PostgreSQL SQLAlchemy URL and return the normalized value."""
    normalized = database_url.strip()
    if not normalized:
        raise ConfigurationError("Database URL is required.")
    try:
        parsed = make_url(normalized)
    except Exception as exc:
        raise ConfigurationError(f"Database URL is invalid: {exc}") from exc
    if parsed.drivername != "postgresql+psycopg":
        raise ConfigurationError(
            "Database URL must use the `postgresql+psycopg://` SQLAlchemy driver."
        )
    if parsed.database is None or not parsed.database.strip():
        raise ConfigurationError("Database URL must include a PostgreSQL database name.")
    return normalized


def validate_database_schema_name(schema_name: str) -> str:
    """Validate a PostgreSQL schema identifier and return the normalized value."""
    normalized = schema_name.strip()
    if not _SCHEMA_NAME_PATTERN.match(normalized):
        raise ConfigurationError(
            "Database schema must start with a letter or underscore and contain only "
            "letters, numbers, and underscores. Use `lifeos_dev` instead of `lifeos-dev`."
        )
    return normalized


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def _serialize_toml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def resolve_config_path(env: Mapping[str, str] | None = None) -> Path:
    """Return the configured config file path."""
    source = env or os.environ
    configured_path = source.get("LIFEOS_CONFIG_FILE")
    if configured_path:
        return Path(configured_path).expanduser()
    return DEFAULT_CONFIG_PATH


def load_config_file(config_path: Path) -> dict[str, Any]:
    """Load the config file when it exists."""
    if not config_path.exists():
        return {}
    with config_path.open("rb") as handle:
        loaded = tomllib.load(handle)
    if not isinstance(loaded, dict):
        raise ConfigurationError(f"Config file {config_path} must contain a top-level TOML table")
    return loaded


@dataclass(frozen=True)
class DatabaseSettings:
    """Database settings loaded from config files and environment variables."""

    database_url: str | None
    database_schema: str
    database_echo: bool
    config_file: Path

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> DatabaseSettings:
        """Build database settings from config files and environment variables."""
        source = env or os.environ
        config_path = resolve_config_path(source)
        file_values = load_config_file(config_path)
        database_values = file_values.get("database", {})
        if database_values and not isinstance(database_values, dict):
            raise ConfigurationError(
                f"Config file {config_path} must define [database] as a TOML table"
            )
        database_values = database_values if isinstance(database_values, dict) else {}

        file_url = database_values.get("url")
        file_schema = database_values.get("schema")
        file_echo = database_values.get("echo")

        database_url = source.get("LIFEOS_DATABASE_URL")
        if database_url is None and isinstance(file_url, str):
            database_url = file_url
        if database_url is not None:
            database_url = validate_database_url(database_url)

        database_schema = source.get("LIFEOS_DATABASE_SCHEMA")
        if database_schema is None and isinstance(file_schema, str):
            database_schema = file_schema
        database_schema = database_schema or DEFAULT_DATABASE_SCHEMA

        database_echo_value = source.get("LIFEOS_DATABASE_ECHO")
        if database_echo_value is not None:
            database_echo = _parse_bool(database_echo_value)
        elif isinstance(file_echo, bool):
            database_echo = file_echo
        elif isinstance(file_echo, str):
            database_echo = _parse_bool(file_echo)
        else:
            database_echo = False

        database_schema = validate_database_schema_name(database_schema)
        return cls(
            database_url=database_url,
            database_schema=database_schema,
            database_echo=database_echo,
            config_file=config_path,
        )

    def require_database_url(self) -> str:
        """Return the configured database URL or raise a helpful error."""
        if self.database_url is None:
            raise ConfigurationError(
                "Database configuration is missing. Run `lifeos init` to create a config file "
                "or set LIFEOS_DATABASE_URL."
            )
        return self.database_url

    def render_database_url(self, *, show_secrets: bool = False) -> str:
        """Render the database URL for display."""
        if self.database_url is None:
            return "<unset>"
        try:
            parsed = make_url(self.database_url)
        except Exception:
            return self.database_url
        return parsed.render_as_string(hide_password=not show_secrets)


def write_database_settings(settings: DatabaseSettings) -> Path:
    """Persist database settings to the configured TOML file."""
    config_path = settings.config_file
    config_path.parent.mkdir(parents=True, exist_ok=True)
    content = "\n".join(
        (
            "[database]",
            f"url = {_serialize_toml_string(settings.require_database_url())}",
            f"schema = {_serialize_toml_string(settings.database_schema)}",
            f"echo = {'true' if settings.database_echo else 'false'}",
            "",
        )
    )
    config_path.write_text(content, encoding="utf-8")
    try:
        os.chmod(config_path, 0o600)
    except OSError:
        pass
    return config_path


def clear_config_cache() -> None:
    """Clear cached config lookups for the current process."""
    get_database_settings.cache_clear()


@lru_cache(maxsize=1)
def get_database_settings() -> DatabaseSettings:
    """Return cached database settings for the current process."""
    return DatabaseSettings.from_env()
