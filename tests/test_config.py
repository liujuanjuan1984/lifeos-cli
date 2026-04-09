from lifeos_cli.config import DatabaseSettings


def test_database_settings_defaults() -> None:
    settings = DatabaseSettings.from_env({})

    assert settings.database_url == "postgresql+psycopg://localhost/lifeos"
    assert settings.database_schema == "lifeos"
    assert settings.database_echo is False


def test_database_settings_honors_env_values() -> None:
    settings = DatabaseSettings.from_env(
        {
            "LIFEOS_DATABASE_URL": "postgresql+psycopg://custom:custom@localhost:5432/custom",
            "LIFEOS_DATABASE_SCHEMA": "lifeos_dev",
            "LIFEOS_DATABASE_ECHO": "true",
        }
    )

    assert settings.database_url.endswith("/custom")
    assert settings.database_schema == "lifeos_dev"
    assert settings.database_echo is True


def test_database_settings_rejects_invalid_schema_name() -> None:
    try:
        DatabaseSettings.from_env({"LIFEOS_DATABASE_SCHEMA": "lifeos-dev"})
    except ValueError as exc:
        assert "schema" in str(exc).lower()
    else:
        raise AssertionError("invalid schema name should fail validation")
