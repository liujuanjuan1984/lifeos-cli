from lifeos_cli.db.base import DATABASE_SCHEMA
from lifeos_cli.db.models import Note


def test_note_model_uses_configured_schema() -> None:
    assert Note.__table__.schema == DATABASE_SCHEMA


def test_note_model_contains_expected_columns() -> None:
    columns = set(Note.__table__.c.keys())

    assert columns == {"content", "id", "created_at", "updated_at", "deleted_at"}
