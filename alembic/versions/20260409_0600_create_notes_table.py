"""Create notes table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260409_0600"
down_revision = None
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()
    op.create_table(
        "notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notes")),
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_notes_created_at"),
        "notes",
        ["created_at"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_notes_deleted_at"),
        "notes",
        ["deleted_at"],
        unique=False,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(op.f("ix_notes_deleted_at"), table_name="notes", schema=schema_name)
    op.drop_index(op.f("ix_notes_created_at"), table_name="notes", schema=schema_name)
    op.drop_table("notes", schema=schema_name)
