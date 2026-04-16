from lifeos_cli.cli_support.runtime_utils import refresh_runtime_configuration
from lifeos_cli.config import clear_config_cache
from lifeos_cli.db.base import DATABASE_SCHEMA, apply_database_schema
from lifeos_cli.db.models import Note


def test_note_model_uses_configured_schema() -> None:
    assert Note.__table__.schema == DATABASE_SCHEMA


def test_note_model_contains_expected_columns() -> None:
    columns = set(Note.__table__.c.keys())

    assert columns == {"content", "id", "created_at", "updated_at", "deleted_at"}


def test_refresh_runtime_configuration_updates_note_model_schema(
    monkeypatch,
    tmp_path,
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://localhost:5432/lifeos_test"',
                'schema = "lifeos_test_runtime"',
                "echo = false",
                "",
                "[preferences]",
                'timezone = "America/Toronto"',
                'language = "en"',
                'day_starts_at = "04:00"',
                'week_starts_on = "monday"',
                "vision_experience_rate_per_hour = 60",
                "",
            )
        ),
        encoding="utf-8",
    )
    original_schema = Note.__table__.schema
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    try:
        refresh_runtime_configuration()
        assert Note.__table__.schema == "lifeos_test_runtime"
    finally:
        clear_config_cache()
        apply_database_schema(original_schema or DATABASE_SCHEMA)
