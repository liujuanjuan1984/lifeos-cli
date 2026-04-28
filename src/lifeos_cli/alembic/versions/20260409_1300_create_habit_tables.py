"""Create habit and habit_action tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260409_1300"
down_revision = "20260409_1200"
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
        "habits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["task_id"],
            [_qualified_column(schema_name, "tasks", "id")],
            name=op.f("fk_habits_task_id_tasks"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habits")),
        schema=schema_name,
    )
    op.create_index(op.f("ix_habits_title"), "habits", ["title"], unique=False, schema=schema_name)
    op.create_index(
        op.f("ix_habits_start_date"),
        "habits",
        ["start_date"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_habits_status"),
        "habits",
        ["status"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_habits_task_id"),
        "habits",
        ["task_id"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "habit_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("habit_id", sa.Uuid(), nullable=False),
        sa.Column("action_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["habit_id"],
            [_qualified_column(schema_name, "habits", "id")],
            name=op.f("fk_habit_actions_habit_id_habits"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_habit_actions")),
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_habit_actions_habit_id"),
        "habit_actions",
        ["habit_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_habit_actions_action_date"),
        "habit_actions",
        ["action_date"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_habit_actions_status"),
        "habit_actions",
        ["status"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "uq_habit_actions_habit_id_action_date_active",
        "habit_actions",
        ["habit_id", "action_date"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(
        "uq_habit_actions_habit_id_action_date_active",
        table_name="habit_actions",
        schema=schema_name,
    )
    op.drop_index(
        op.f("ix_habit_actions_status"),
        table_name="habit_actions",
        schema=schema_name,
    )
    op.drop_index(
        op.f("ix_habit_actions_action_date"),
        table_name="habit_actions",
        schema=schema_name,
    )
    op.drop_index(
        op.f("ix_habit_actions_habit_id"),
        table_name="habit_actions",
        schema=schema_name,
    )
    op.drop_table("habit_actions", schema=schema_name)

    op.drop_index(op.f("ix_habits_task_id"), table_name="habits", schema=schema_name)
    op.drop_index(op.f("ix_habits_status"), table_name="habits", schema=schema_name)
    op.drop_index(op.f("ix_habits_start_date"), table_name="habits", schema=schema_name)
    op.drop_index(op.f("ix_habits_title"), table_name="habits", schema=schema_name)
    op.drop_table("habits", schema=schema_name)
