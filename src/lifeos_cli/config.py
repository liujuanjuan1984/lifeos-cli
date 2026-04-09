"""Runtime configuration for lifeos_cli."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.engine import make_url

try:
    import tomllib  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 fallback
    import tomli as tomllib

DEFAULT_DATABASE_SCHEMA = "lifeos"
DEFAULT_CONFIG_PATH = Path.home() / ".config" / "lifeos" / "config.toml"
DEFAULT_LANGUAGE = "en"
DEFAULT_DAY_STARTS_AT = "00:00"
DEFAULT_WEEK_STARTS_ON = "monday"
_SCHEMA_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_LANGUAGE_TAG_PATTERN = re.compile(r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
_DAY_STARTS_AT_PATTERN = re.compile(r"^(?P<hour>[01]\d|2[0-3]):(?P<minute>[0-5]\d)$")
_WEEK_STARTS_ON_VALUES = {"monday", "sunday"}


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


def detect_default_timezone(env: Mapping[str, str] | None = None) -> str:
    """Return a stable default timezone name for local preferences."""
    source = env or os.environ
    explicit_timezone = source.get("TZ")
    if explicit_timezone:
        try:
            return validate_timezone_name(explicit_timezone)
        except ConfigurationError:
            pass

    local_timezone = datetime.now().astimezone().tzinfo
    local_key = getattr(local_timezone, "key", None)
    if isinstance(local_key, str):
        try:
            return validate_timezone_name(local_key)
        except ConfigurationError:
            pass

    return "UTC"


def validate_timezone_name(timezone_name: str) -> str:
    """Validate an IANA timezone name and return the normalized value."""
    normalized = timezone_name.strip()
    if not normalized:
        raise ConfigurationError("Preference `timezone` is required.")
    try:
        ZoneInfo(normalized)
    except ZoneInfoNotFoundError as exc:
        raise ConfigurationError(
            f"Preference `timezone` must be a valid IANA timezone name, got {normalized!r}."
        ) from exc
    return normalized


def _normalize_language_value(language: str) -> str:
    normalized = language.strip()
    if not normalized:
        raise ConfigurationError("Preference `language` is required.")
    normalized = normalized.split(".", maxsplit=1)[0].replace("_", "-")
    if normalized in {"C", "POSIX"}:
        return DEFAULT_LANGUAGE
    return normalized


def validate_language(language: str) -> str:
    """Validate a language tag used for user-facing preferences."""
    normalized = _normalize_language_value(language)
    if not _LANGUAGE_TAG_PATTERN.match(normalized):
        raise ConfigurationError(
            "Preference `language` must be a valid language tag such as `en`, "
            "`en-CA`, or `zh-Hans`."
        )
    return normalized


def detect_default_language(env: Mapping[str, str] | None = None) -> str:
    """Return a stable default language value for preferences."""
    source = env or os.environ
    for key in ("LC_ALL", "LANG"):
        candidate = source.get(key)
        if candidate:
            try:
                return validate_language(candidate)
            except ConfigurationError:
                continue
    return DEFAULT_LANGUAGE


def validate_day_starts_at(value: str) -> str:
    """Validate the local day boundary used for grouping time-based records."""
    normalized = value.strip()
    if not _DAY_STARTS_AT_PATTERN.match(normalized):
        raise ConfigurationError(
            "Preference `day_starts_at` must use 24-hour `HH:MM` format, for example `04:00`."
        )
    return normalized


def validate_week_starts_on(value: str) -> str:
    """Validate the preferred first day of the week."""
    normalized = value.strip().lower()
    if normalized not in _WEEK_STARTS_ON_VALUES:
        supported = ", ".join(sorted(_WEEK_STARTS_ON_VALUES))
        raise ConfigurationError(f"Preference `week_starts_on` must be one of: {supported}.")
    return normalized


def _parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def _serialize_toml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _render_database_table(settings: DatabaseSettings) -> str:
    """Render the `[database]` TOML table for persisted settings."""
    return "\n".join(
        (
            "[database]",
            f"url = {_serialize_toml_string(settings.require_database_url())}",
            f"schema = {_serialize_toml_string(settings.database_schema)}",
            f"echo = {'true' if settings.database_echo else 'false'}",
        )
    )


def _render_preferences_table(settings: PreferencesSettings) -> str:
    """Render the `[preferences]` TOML table for persisted settings."""
    return "\n".join(
        (
            "[preferences]",
            f"timezone = {_serialize_toml_string(settings.timezone)}",
            f"language = {_serialize_toml_string(settings.language)}",
            f"day_starts_at = {_serialize_toml_string(settings.day_starts_at)}",
            f"week_starts_on = {_serialize_toml_string(settings.week_starts_on)}",
        )
    )


def _replace_top_level_table(existing_content: str, *, table_name: str, replacement: str) -> str:
    """Replace or append a top-level TOML table while preserving other file content."""
    section_header = f"[{table_name}]"
    header_pattern = re.compile(r"^\[[^\[\]].*\]$")
    lines = existing_content.splitlines()
    start_index: int | None = None
    end_index = len(lines)

    for index, line in enumerate(lines):
        if line.strip() == section_header:
            start_index = index
            break

    replacement_lines = replacement.splitlines()
    if start_index is None:
        if not lines:
            return f"{replacement}\n"
        if lines[-1].strip():
            lines.append("")
        lines.extend(replacement_lines)
        return "\n".join(lines) + "\n"

    for index in range(start_index + 1, len(lines)):
        if header_pattern.match(lines[index].strip()):
            end_index = index
            break

    updated_lines = lines[:start_index] + replacement_lines + lines[end_index:]
    return "\n".join(updated_lines) + "\n"


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


@dataclass(frozen=True)
class PreferencesSettings:
    """User preference values persisted in the local config file."""

    timezone: str
    language: str
    day_starts_at: str
    week_starts_on: str
    config_file: Path

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> PreferencesSettings:
        """Build preferences from config files and optional environment overrides."""
        source = env or os.environ
        config_path = resolve_config_path(source)
        file_values = load_config_file(config_path)
        preference_values = file_values.get("preferences", {})
        if preference_values and not isinstance(preference_values, dict):
            raise ConfigurationError(
                f"Config file {config_path} must define [preferences] as a TOML table"
            )
        preference_values = preference_values if isinstance(preference_values, dict) else {}

        file_timezone = preference_values.get("timezone")
        file_language = preference_values.get("language")
        file_day_starts_at = preference_values.get("day_starts_at")
        file_week_starts_on = preference_values.get("week_starts_on")

        timezone_value = source.get("LIFEOS_TIMEZONE")
        if timezone_value is None and isinstance(file_timezone, str):
            timezone_value = file_timezone
        timezone_value = validate_timezone_name(timezone_value or detect_default_timezone(source))

        language_value = source.get("LIFEOS_LANGUAGE")
        if language_value is None and isinstance(file_language, str):
            language_value = file_language
        language_value = validate_language(language_value or detect_default_language(source))

        day_starts_at_value = source.get("LIFEOS_DAY_STARTS_AT")
        if day_starts_at_value is None and isinstance(file_day_starts_at, str):
            day_starts_at_value = file_day_starts_at
        day_starts_at_value = validate_day_starts_at(day_starts_at_value or DEFAULT_DAY_STARTS_AT)

        week_starts_on_value = source.get("LIFEOS_WEEK_STARTS_ON")
        if week_starts_on_value is None and isinstance(file_week_starts_on, str):
            week_starts_on_value = file_week_starts_on
        week_starts_on_value = validate_week_starts_on(
            week_starts_on_value or DEFAULT_WEEK_STARTS_ON
        )

        return cls(
            timezone=timezone_value,
            language=language_value,
            day_starts_at=day_starts_at_value,
            week_starts_on=week_starts_on_value,
            config_file=config_path,
        )


def write_database_settings(
    settings: DatabaseSettings,
    *,
    preferences: PreferencesSettings | None = None,
) -> Path:
    """Persist database settings, keeping preferences in the same config file."""
    config_path = settings.config_file
    config_path.parent.mkdir(parents=True, exist_ok=True)
    existing_content = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    database_content = _replace_top_level_table(
        existing_content,
        table_name="database",
        replacement=_render_database_table(settings),
    )
    resolved_preferences = preferences
    if resolved_preferences is None:
        env = dict(os.environ)
        env["LIFEOS_CONFIG_FILE"] = str(config_path)
        resolved_preferences = PreferencesSettings.from_env(env)
    content = _replace_top_level_table(
        database_content,
        table_name="preferences",
        replacement=_render_preferences_table(resolved_preferences),
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
    get_preferences_settings.cache_clear()


@lru_cache(maxsize=1)
def get_database_settings() -> DatabaseSettings:
    """Return cached database settings for the current process."""
    return DatabaseSettings.from_env()


@lru_cache(maxsize=1)
def get_preferences_settings() -> PreferencesSettings:
    """Return cached user preference values for the current process."""
    return PreferencesSettings.from_env()
