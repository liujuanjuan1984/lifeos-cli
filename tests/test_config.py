from __future__ import annotations

from pathlib import Path

from lifeos_cli.application.configuration import (
    InitializationPrompts,
    InitializationRequest,
    build_database_settings,
    build_preferences_settings,
)
from lifeos_cli.config import (
    ConfigurationError,
    DatabaseSettings,
    PreferencesSettings,
    detect_default_language,
    validate_database_schema_name,
    validate_database_url,
    validate_day_starts_at,
    validate_language,
    validate_timezone_name,
    validate_week_starts_on,
    write_database_settings,
)


def test_database_settings_defaults_use_config_path_and_no_database_url(tmp_path: Path) -> None:
    config_path = tmp_path / "missing-config.toml"
    settings = DatabaseSettings.from_env({"LIFEOS_CONFIG_FILE": str(config_path)})

    assert settings.database_url is None
    assert settings.database_schema == "lifeos"
    assert settings.database_echo is False
    assert settings.config_file == config_path


def test_database_settings_honors_env_values(tmp_path: Path) -> None:
    config_path = tmp_path / "missing-config.toml"
    settings = DatabaseSettings.from_env(
        {
            "LIFEOS_CONFIG_FILE": str(config_path),
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


def test_database_settings_rejects_invalid_schema_name(tmp_path: Path) -> None:
    config_path = tmp_path / "missing-config.toml"
    try:
        DatabaseSettings.from_env(
            {
                "LIFEOS_CONFIG_FILE": str(config_path),
                "LIFEOS_DATABASE_SCHEMA": "lifeos-dev",
            }
        )
    except ConfigurationError as exc:
        assert "lifeos_dev" in str(exc)
    else:
        raise AssertionError("invalid schema name should fail validation")


def test_validate_database_schema_name_accepts_underscores() -> None:
    assert validate_database_schema_name("lifeos_dev") == "lifeos_dev"


def test_preferences_settings_honor_env_values(tmp_path: Path) -> None:
    config_path = tmp_path / "missing-config.toml"
    settings = PreferencesSettings.from_env(
        {
            "LIFEOS_CONFIG_FILE": str(config_path),
            "LIFEOS_TIMEZONE": "America/Toronto",
            "LIFEOS_LANGUAGE": "zh_Hans.UTF-8",
            "LIFEOS_DAY_STARTS_AT": "04:00",
            "LIFEOS_WEEK_STARTS_ON": "sunday",
        }
    )

    assert settings.timezone == "America/Toronto"
    assert settings.language == "zh-Hans"
    assert settings.day_starts_at == "04:00"
    assert settings.week_starts_on == "sunday"


def test_preferences_settings_read_config_file(tmp_path: Path) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[preferences]",
                'timezone = "America/Toronto"',
                'language = "zh-Hans"',
                'day_starts_at = "04:00"',
                'week_starts_on = "sunday"',
                "",
            )
        ),
        encoding="utf-8",
    )

    settings = PreferencesSettings.from_env({"LIFEOS_CONFIG_FILE": str(config_path)})

    assert settings.timezone == "America/Toronto"
    assert settings.language == "zh-Hans"
    assert settings.day_starts_at == "04:00"
    assert settings.week_starts_on == "sunday"


def test_validate_database_url_requires_postgresql_psycopg_driver() -> None:
    try:
        validate_database_url("sqlite:///lifeos.db")
    except ConfigurationError as exc:
        assert "postgresql+psycopg://" in str(exc)
    else:
        raise AssertionError("invalid driver should fail validation")


def test_require_database_url_raises_helpful_error(tmp_path: Path) -> None:
    config_path = tmp_path / "missing-config.toml"
    settings = DatabaseSettings.from_env({"LIFEOS_CONFIG_FILE": str(config_path)})

    try:
        settings.require_database_url()
    except ConfigurationError as exc:
        assert "lifeos init" in str(exc)
    else:
        raise AssertionError("missing database URL should fail")


def test_validate_timezone_name_rejects_unknown_values() -> None:
    try:
        validate_timezone_name("Mars/Base")
    except ConfigurationError as exc:
        assert "IANA timezone" in str(exc)
    else:
        raise AssertionError("invalid timezone should fail validation")


def test_validate_language_accepts_bcp47_like_values() -> None:
    assert validate_language("zh_Hans.UTF-8") == "zh-Hans"


def test_detect_default_language_uses_environment() -> None:
    assert detect_default_language({"LANG": "zh_Hans.UTF-8"}) == "zh-Hans"


def test_validate_day_starts_at_rejects_invalid_values() -> None:
    try:
        validate_day_starts_at("24:30")
    except ConfigurationError as exc:
        assert "HH:MM" in str(exc)
    else:
        raise AssertionError("invalid day start should fail validation")


def test_validate_week_starts_on_rejects_invalid_values() -> None:
    try:
        validate_week_starts_on("friday")
    except ConfigurationError as exc:
        assert "monday" in str(exc)
        assert "sunday" in str(exc)
    else:
        raise AssertionError("invalid week start should fail validation")


def test_write_database_settings_persists_toml(tmp_path: Path) -> None:
    config_path = tmp_path / "lifeos" / "config.toml"
    database_settings = DatabaseSettings(
        database_url="postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        database_schema="lifeos",
        database_echo=False,
        config_file=config_path,
    )
    preferences_settings = PreferencesSettings(
        timezone="America/Toronto",
        language="zh-Hans",
        day_starts_at="04:00",
        week_starts_on="sunday",
        config_file=config_path,
    )

    written_path = write_database_settings(database_settings, preferences=preferences_settings)

    assert written_path == config_path
    content = config_path.read_text(encoding="utf-8")
    assert "[database]" in content
    assert "[preferences]" in content
    assert 'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"' in content
    assert 'timezone = "America/Toronto"' in content


def test_write_database_settings_preserves_other_top_level_sections(tmp_path: Path) -> None:
    config_path = tmp_path / "lifeos" / "config.toml"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        "\n".join(
            (
                "# Existing file header",
                "[database]",
                'url = "postgresql+psycopg://old-user:<old-password>@localhost:5432/old_lifeos"',
                'schema = "old_schema"',
                "echo = true",
                "",
                "[preferences]",
                'timezone = "UTC"',
                'language = "en"',
                'day_starts_at = "00:00"',
                'week_starts_on = "monday"',
                "",
                "[notes]",
                'default_editor = "nvim"',
                "",
            )
        ),
        encoding="utf-8",
    )
    database_settings = DatabaseSettings(
        database_url="postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        database_schema="lifeos_dev",
        database_echo=False,
        config_file=config_path,
    )
    preferences_settings = PreferencesSettings(
        timezone="America/Toronto",
        language="zh-Hans",
        day_starts_at="04:00",
        week_starts_on="sunday",
        config_file=config_path,
    )

    written_path = write_database_settings(database_settings, preferences=preferences_settings)

    assert written_path == config_path
    content = config_path.read_text(encoding="utf-8")
    assert "# Existing file header" in content
    assert "[notes]" in content
    assert 'default_editor = "nvim"' in content
    assert 'schema = "lifeos_dev"' in content
    assert 'timezone = "America/Toronto"' in content
    assert 'language = "zh-Hans"' in content
    assert (
        'url = "postgresql+psycopg://old-user:<old-password>@localhost:5432/old_lifeos"'
        not in content
    )


def test_build_database_settings_uses_injected_prompts(
    monkeypatch,
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "lifeos" / "config.toml"
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    request = InitializationRequest(
        database_url=None,
        schema=None,
        echo=None,
        timezone=None,
        language=None,
        day_starts_at=None,
        week_starts_on=None,
        non_interactive=False,
        is_interactive=True,
        prompts=InitializationPrompts(
            prompt_database_url=lambda default: (
                "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"
            ),
            prompt_database_schema=lambda default: "lifeos_dev",
            prompt_database_echo=lambda default: True,
        ),
    )

    settings = build_database_settings(request)

    assert (
        settings.database_url == "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"
    )
    assert settings.database_schema == "lifeos_dev"
    assert settings.database_echo is True
    assert settings.config_file == config_path


def test_build_preferences_settings_uses_explicit_values(monkeypatch, tmp_path: Path) -> None:
    config_path = tmp_path / "lifeos" / "config.toml"
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    request = InitializationRequest(
        database_url=None,
        schema=None,
        echo=None,
        timezone="America/Toronto",
        language="zh-Hans",
        day_starts_at="04:00",
        week_starts_on="sunday",
        non_interactive=True,
        is_interactive=False,
        prompts=None,
    )

    settings = build_preferences_settings(request)

    assert settings.timezone == "America/Toronto"
    assert settings.language == "zh-Hans"
    assert settings.day_starts_at == "04:00"
    assert settings.week_starts_on == "sunday"
    assert settings.config_file == config_path


def test_build_preferences_settings_uses_environment_defaults(monkeypatch, tmp_path: Path) -> None:
    config_path = tmp_path / "lifeos" / "config.toml"
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setenv("TZ", "America/Toronto")
    monkeypatch.delenv("LC_ALL", raising=False)
    monkeypatch.setenv("LANG", "zh_Hans.UTF-8")
    request = InitializationRequest(
        database_url=None,
        schema=None,
        echo=None,
        timezone=None,
        language=None,
        day_starts_at=None,
        week_starts_on=None,
        non_interactive=True,
        is_interactive=False,
        prompts=None,
    )

    settings = build_preferences_settings(request)

    assert settings.timezone == "America/Toronto"
    assert settings.language == "zh-Hans"
    assert settings.day_starts_at == "00:00"
    assert settings.week_starts_on == "monday"
