from __future__ import annotations

from pathlib import Path

from lifeos_cli.config import (
    DEFAULT_CONFIG_PATH,
    ConfigurationError,
    DatabaseSettings,
    write_database_settings,
)


def test_database_settings_defaults_use_config_path_and_no_database_url() -> None:
    settings = DatabaseSettings.from_env({})

    assert settings.database_url is None
    assert settings.database_schema == "lifeos"
    assert settings.database_echo is False
    assert settings.config_file == DEFAULT_CONFIG_PATH


def test_database_settings_honors_env_values() -> None:
    settings = DatabaseSettings.from_env(
        {
            "LIFEOS_DATABASE_URL": "postgresql+psycopg://localhost/custom",
            "LIFEOS_DATABASE_SCHEMA": "lifeos_dev",
            "LIFEOS_DATABASE_ECHO": "true",
        }
    )

    assert settings.database_url == "postgresql+psycopg://localhost/custom"
    assert settings.database_schema == "lifeos_dev"
    assert settings.database_echo is True


def test_database_settings_reads_config_file(tmp_path: Path) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://localhost/from_file"',
                'schema = "lifeos_notes"',
                "echo = true",
                "",
            )
        ),
        encoding="utf-8",
    )

    settings = DatabaseSettings.from_env({"LIFEOS_CONFIG_FILE": str(config_path)})

    assert settings.database_url == "postgresql+psycopg://localhost/from_file"
    assert settings.database_schema == "lifeos_notes"
    assert settings.database_echo is True


def test_database_settings_rejects_invalid_schema_name() -> None:
    try:
        DatabaseSettings.from_env({"LIFEOS_DATABASE_SCHEMA": "lifeos-dev"})
    except ValueError as exc:
        assert "schema" in str(exc).lower()
    else:
        raise AssertionError("invalid schema name should fail validation")


def test_require_database_url_raises_helpful_error() -> None:
    settings = DatabaseSettings.from_env({})

    try:
        settings.require_database_url()
    except ConfigurationError as exc:
        assert "lifeos init" in str(exc)
    else:
        raise AssertionError("missing database URL should fail")


def test_write_database_settings_persists_toml(tmp_path: Path) -> None:
    config_path = tmp_path / "lifeos" / "config.toml"
    settings = DatabaseSettings(
        database_url="postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        database_schema="lifeos",
        database_echo=False,
        config_file=config_path,
    )

    written_path = write_database_settings(settings)

    assert written_path == config_path
    content = config_path.read_text(encoding="utf-8")
    assert "[database]" in content
    assert 'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"' in content
