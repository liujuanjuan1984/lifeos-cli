"""Configuration workflows shared by CLI entrypoints."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from pathlib import Path

from lifeos_cli.cli_support.runtime_utils import refresh_runtime_configuration
from lifeos_cli.config import (
    DEFAULT_DATABASE_SCHEMA,
    DEFAULT_DAY_STARTS_AT,
    DEFAULT_VISION_EXPERIENCE_RATE_PER_HOUR,
    DEFAULT_WEEK_STARTS_ON,
    ConfigurationError,
    DatabaseSettings,
    PreferencesSettings,
    detect_default_language,
    detect_default_timezone,
    parse_boolean_value,
    resolve_config_path,
    validate_database_schema_name,
    validate_database_url,
    validate_day_starts_at,
    validate_language,
    validate_timezone_name,
    validate_vision_experience_rate_per_hour,
    validate_week_starts_on,
    write_database_settings,
)


@dataclass(frozen=True)
class InitializationPrompts:
    """Interactive prompt callables used to collect missing config values."""

    prompt_database_url: Callable[[str | None], str]
    prompt_database_schema: Callable[[str | None], str]
    prompt_language: Callable[[str | None], str]
    prompt_database_echo: Callable[[bool], bool]


@dataclass(frozen=True)
class InitializationRequest:
    """Input values for configuration initialization."""

    database_url: str | None
    schema: str | None
    echo: bool | None
    timezone: str | None
    language: str | None
    day_starts_at: str | None
    week_starts_on: str | None
    vision_experience_rate_per_hour: int | None
    non_interactive: bool
    is_interactive: bool
    prompts: InitializationPrompts | None = None


SUPPORTED_CONFIG_KEYS = (
    "database.url",
    "database.schema",
    "database.echo",
    "preferences.timezone",
    "preferences.language",
    "preferences.day_starts_at",
    "preferences.week_starts_on",
    "preferences.vision_experience_rate_per_hour",
)


@dataclass(frozen=True)
class ConfigSetResult:
    """Result of one config set write operation."""

    key: str
    config_path: Path
    database_settings: DatabaseSettings
    preferences_settings: PreferencesSettings


def build_database_settings(request: InitializationRequest) -> DatabaseSettings:
    """Build database settings from explicit input, current config, and prompts."""
    config_path = resolve_config_path()
    try:
        current = DatabaseSettings.from_env(include_overrides=False)
    except (ConfigurationError, ValueError):
        current = DatabaseSettings(
            database_url=None,
            database_schema=DEFAULT_DATABASE_SCHEMA,
            database_echo=False,
            config_file=config_path,
        )
    database_url = request.database_url or current.database_url
    database_schema = request.schema or current.database_schema
    database_echo = current.database_echo if request.echo is None else request.echo

    if not request.non_interactive and request.is_interactive:
        if request.prompts is None:
            raise ConfigurationError(
                "Interactive initialization requires prompt handlers to collect missing values."
            )
        if request.database_url is None:
            database_url = request.prompts.prompt_database_url(database_url)
        if request.schema is None:
            database_schema = request.prompts.prompt_database_schema(database_schema)
        if request.echo is None:
            database_echo = request.prompts.prompt_database_echo(database_echo)

    if database_url is None:
        raise ConfigurationError(
            "Database URL is required. Provide --database-url or run `lifeos init` interactively."
        )

    return DatabaseSettings(
        database_url=validate_database_url(database_url),
        database_schema=validate_database_schema_name(database_schema),
        database_echo=database_echo,
        config_file=config_path,
    )


def build_preferences_settings(request: InitializationRequest) -> PreferencesSettings:
    """Build preference settings from explicit input and current config."""
    config_path = resolve_config_path()
    try:
        current = PreferencesSettings.from_env(include_overrides=False)
    except (ConfigurationError, ValueError):
        current = PreferencesSettings(
            timezone=detect_default_timezone(),
            language=detect_default_language(),
            day_starts_at=DEFAULT_DAY_STARTS_AT,
            week_starts_on=DEFAULT_WEEK_STARTS_ON,
            vision_experience_rate_per_hour=DEFAULT_VISION_EXPERIENCE_RATE_PER_HOUR,
            config_file=config_path,
        )

    timezone_value = request.timezone or current.timezone
    language_value = request.language or current.language
    day_starts_at_value = request.day_starts_at or current.day_starts_at
    week_starts_on_value = request.week_starts_on or current.week_starts_on
    vision_experience_rate_value = (
        current.vision_experience_rate_per_hour
        if request.vision_experience_rate_per_hour is None
        else request.vision_experience_rate_per_hour
    )

    if not request.non_interactive and request.is_interactive and request.language is None:
        if request.prompts is None:
            raise ConfigurationError(
                "Interactive initialization requires prompt handlers to collect missing values."
            )
        language_value = request.prompts.prompt_language(language_value)

    return PreferencesSettings(
        timezone=validate_timezone_name(timezone_value),
        language=validate_language(language_value),
        day_starts_at=validate_day_starts_at(day_starts_at_value),
        week_starts_on=validate_week_starts_on(week_starts_on_value),
        vision_experience_rate_per_hour=validate_vision_experience_rate_per_hour(
            vision_experience_rate_value
        ),
        config_file=config_path,
    )


def persist_runtime_settings(
    database_settings: DatabaseSettings,
    preferences_settings: PreferencesSettings,
) -> Path:
    """Write config changes and refresh runtime caches."""
    config_path = write_database_settings(
        database_settings,
        preferences=preferences_settings,
    )
    refresh_runtime_configuration()
    return config_path


def set_runtime_config_value(*, key: str, value: str) -> ConfigSetResult:
    """Persist one supported runtime config key and refresh caches."""
    normalized_key = key.strip()
    if normalized_key not in SUPPORTED_CONFIG_KEYS:
        supported_keys = ", ".join(SUPPORTED_CONFIG_KEYS)
        raise ConfigurationError(
            f"Unsupported config key {normalized_key!r}. Supported keys: {supported_keys}"
        )

    database_settings = DatabaseSettings.from_env(include_overrides=False)
    preferences_settings = PreferencesSettings.from_env(include_overrides=False)

    if normalized_key == "database.url":
        database_settings = replace(
            database_settings,
            database_url=validate_database_url(value),
        )
    elif normalized_key == "database.schema":
        database_settings = replace(
            database_settings,
            database_schema=validate_database_schema_name(value),
        )
    elif normalized_key == "database.echo":
        database_settings = replace(
            database_settings,
            database_echo=parse_boolean_value(value, field_name="Config key `database.echo`"),
        )
    elif normalized_key == "preferences.timezone":
        preferences_settings = replace(
            preferences_settings,
            timezone=validate_timezone_name(value),
        )
    elif normalized_key == "preferences.language":
        preferences_settings = replace(
            preferences_settings,
            language=validate_language(value),
        )
    elif normalized_key == "preferences.day_starts_at":
        preferences_settings = replace(
            preferences_settings,
            day_starts_at=validate_day_starts_at(value),
        )
    elif normalized_key == "preferences.week_starts_on":
        preferences_settings = replace(
            preferences_settings,
            week_starts_on=validate_week_starts_on(value),
        )
    elif normalized_key == "preferences.vision_experience_rate_per_hour":
        preferences_settings = replace(
            preferences_settings,
            vision_experience_rate_per_hour=validate_vision_experience_rate_per_hour(value),
        )

    written_path = write_database_settings(
        database_settings,
        preferences=preferences_settings,
    )
    refresh_runtime_configuration()
    return ConfigSetResult(
        key=normalized_key,
        config_path=written_path,
        database_settings=database_settings,
        preferences_settings=preferences_settings,
    )
