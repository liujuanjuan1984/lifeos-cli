"""Add timelog quick template table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260617_1200"
down_revision = "20260412_1600"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def _qualified_column(schema_name: str | None, table_name: str, column_name: str) -> str:
    if schema_name is None:
        return f"{table_name}.{column_name}"
    return f"{schema_name}.{table_name}.{column_name}"


def upgrade() -> None:
    schema_name = _schema_name()
    op.create_table(
        "timelog_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("title_normalized", sa.String(length=200), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=True),
        sa.Column("default_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("usage_count", sa.Integer(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["area_id"],
            [_qualified_column(schema_name, "areas", "id")],
            name=op.f("fk_timelog_templates_area_id_areas"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_timelog_templates")),
        schema=schema_name,
    )
    op.create_index(
        "uq_timelog_templates_title_normalized_active",
        "timelog_templates",
        ["title_normalized"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_timelog_templates_area_id",
        "timelog_templates",
        ["area_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_timelog_templates_position",
        "timelog_templates",
        ["position"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_timelog_templates_usage",
        "timelog_templates",
        ["usage_count", "last_used_at"],
        unique=False,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(
        "ix_timelog_templates_usage",
        table_name="timelog_templates",
        schema=schema_name,
    )
    op.drop_index(
        "ix_timelog_templates_position",
        table_name="timelog_templates",
        schema=schema_name,
    )
    op.drop_index(
        "ix_timelog_templates_area_id",
        table_name="timelog_templates",
        schema=schema_name,
    )
    op.drop_index(
        "uq_timelog_templates_title_normalized_active",
        table_name="timelog_templates",
        schema=schema_name,
    )
    op.drop_table("timelog_templates", schema=schema_name)
