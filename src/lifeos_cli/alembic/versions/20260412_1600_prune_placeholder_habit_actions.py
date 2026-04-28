"""Prune placeholder habit-action rows after switching to sparse materialization."""

from __future__ import annotations

from alembic import op

revision = "20260412_1600"
down_revision = "20260412_1100"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def _qualified_table(schema_name: str | None, table_name: str) -> str:
    if schema_name is None:
        return f'"{table_name}"'
    return f'"{schema_name}"."{table_name}"'


def upgrade() -> None:
    schema_name = _schema_name()
    op.execute(
        f"DELETE FROM {_qualified_table(schema_name, 'habit_actions')} "
        "WHERE status = 'pending' AND notes IS NULL AND deleted_at IS NULL"
    )


def downgrade() -> None:
    return None
