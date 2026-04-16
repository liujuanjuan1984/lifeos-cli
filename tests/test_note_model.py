from lifeos_cli.cli_support.runtime_utils import refresh_runtime_configuration
from lifeos_cli.config import clear_config_cache
from lifeos_cli.db.base import DATABASE_SCHEMA, apply_database_schema
from lifeos_cli.db.models import Note
from tests.config_support import install_test_config


def test_note_model_uses_configured_schema() -> None:
    assert Note.__table__.schema == DATABASE_SCHEMA


def test_note_model_contains_expected_columns() -> None:
    columns = set(Note.__table__.c.keys())

    assert columns == {"content", "id", "created_at", "updated_at", "deleted_at"}


def test_refresh_runtime_configuration_updates_note_model_schema(
    monkeypatch,
    tmp_path,
) -> None:
    original_schema = Note.__table__.schema
    install_test_config(
        monkeypatch=monkeypatch,
        tmp_path=tmp_path,
        include_database=True,
        database_schema="lifeos_test_runtime",
        include_preferences=True,
        vision_experience_rate_per_hour=60,
    )

    try:
        refresh_runtime_configuration()
        assert Note.__table__.schema == "lifeos_test_runtime"
    finally:
        clear_config_cache()
        apply_database_schema(original_schema or DATABASE_SCHEMA)
