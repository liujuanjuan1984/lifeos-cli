from lifeos_cli.db.models import Note


def test_note_model_leaves_schema_binding_to_runtime_engine() -> None:
    assert Note.__table__.schema is None


def test_note_model_contains_expected_columns() -> None:
    columns = set(Note.__table__.c.keys())

    assert columns == {"content", "id", "created_at", "updated_at", "deleted_at"}
