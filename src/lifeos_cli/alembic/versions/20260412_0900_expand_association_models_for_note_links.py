"""Expand generic associations to cover note links to events and visions."""

from __future__ import annotations

from alembic import op

revision = "20260412_0900"
down_revision = "20260411_1500"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("associations", schema=schema_name) as batch_op:
        batch_op.drop_constraint(
            "ck_associations_source_model_valid",
            type_="check",
        )
        batch_op.drop_constraint(
            "ck_associations_target_model_valid",
            type_="check",
        )
        batch_op.create_check_constraint(
            "ck_associations_source_model_valid",
            "source_model IN ('event', 'note', 'person', 'task', 'timelog', 'vision')",
        )
        batch_op.create_check_constraint(
            "ck_associations_target_model_valid",
            "target_model IN ('event', 'note', 'person', 'task', 'timelog', 'vision')",
        )


def downgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("associations", schema=schema_name) as batch_op:
        batch_op.drop_constraint(
            "ck_associations_source_model_valid",
            type_="check",
        )
        batch_op.drop_constraint(
            "ck_associations_target_model_valid",
            type_="check",
        )
        batch_op.create_check_constraint(
            "ck_associations_source_model_valid",
            "source_model IN ('note', 'person', 'task', 'timelog')",
        )
        batch_op.create_check_constraint(
            "ck_associations_target_model_valid",
            "target_model IN ('note', 'person', 'task', 'timelog')",
        )
