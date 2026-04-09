"""Configuration workflows shared by CLI entrypoints."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from lifeos_cli.cli_support.runtime_utils import refresh_runtime_configuration
from lifeos_cli.config import (
    DEFAULT_DATABASE_SCHEMA,
    ConfigurationError,
    DatabaseSettings,
    get_database_settings,
    resolve_config_path,
    validate_database_schema_name,
    validate_database_url,
    write_database_settings,
)


@dataclass(frozen=True)
class InitializationPrompts:
    """Interactive prompt callables used to collect missing config values."""

    prompt_database_url: Callable[[str | None], str]
    prompt_database_schema: Callable[[str | None], str]
    prompt_database_echo: Callable[[bool], bool]


@dataclass(frozen=True)
class InitializationRequest:
    """Input values for configuration initialization."""

    database_url: str | None
    schema: str | None
    echo: bool | None
    non_interactive: bool
    is_interactive: bool
    prompts: InitializationPrompts | None = None


def build_database_settings(request: InitializationRequest) -> DatabaseSettings:
    """Build database settings from explicit input, current config, and prompts."""
    config_path = resolve_config_path()
    try:
        current = get_database_settings()
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


def persist_database_settings(settings: DatabaseSettings) -> Path:
    """Write config changes and refresh runtime caches."""
    config_path = write_database_settings(settings)
    refresh_runtime_configuration()
    return config_path
