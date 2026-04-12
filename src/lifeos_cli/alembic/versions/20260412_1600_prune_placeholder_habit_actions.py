"""Prune placeholder habit-action rows after switching to sparse materialization."""

from __future__ import annotations

from alembic import op

revision = "20260412_1600"
down_revision = "20260412_1100"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()
    op.execute(
        f'DELETE FROM "{schema_name}".habit_actions '
        "WHERE status = 'pending' AND notes IS NULL AND deleted_at IS NULL"
    )


def downgrade() -> None:
    return None
