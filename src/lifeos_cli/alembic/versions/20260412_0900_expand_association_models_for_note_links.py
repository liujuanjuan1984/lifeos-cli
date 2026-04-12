"""Expand generic associations to cover note links to events and visions."""

from __future__ import annotations

from alembic import op

revision = "20260412_0900"
down_revision = "20260411_1500"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.drop_constraint(
        "ck_associations_source_model_valid",
        "associations",
        schema=schema_name,
        type_="check",
    )
    op.drop_constraint(
        "ck_associations_target_model_valid",
        "associations",
        schema=schema_name,
        type_="check",
    )
    op.create_check_constraint(
        "ck_associations_source_model_valid",
        "associations",
        "source_model IN ('event', 'note', 'person', 'task', 'timelog', 'vision')",
        schema=schema_name,
    )
    op.create_check_constraint(
        "ck_associations_target_model_valid",
        "associations",
        "target_model IN ('event', 'note', 'person', 'task', 'timelog', 'vision')",
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()

    op.drop_constraint(
        "ck_associations_source_model_valid",
        "associations",
        schema=schema_name,
        type_="check",
    )
    op.drop_constraint(
        "ck_associations_target_model_valid",
        "associations",
        schema=schema_name,
        type_="check",
    )
    op.create_check_constraint(
        "ck_associations_source_model_valid",
        "associations",
        "source_model IN ('note', 'person', 'task', 'timelog')",
        schema=schema_name,
    )
    op.create_check_constraint(
        "ck_associations_target_model_valid",
        "associations",
        "target_model IN ('note', 'person', 'task', 'timelog')",
        schema=schema_name,
    )
