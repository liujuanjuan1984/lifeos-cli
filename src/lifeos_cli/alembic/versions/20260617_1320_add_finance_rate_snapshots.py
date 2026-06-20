"""Add finance exchange-rate snapshots."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260617_1320"
down_revision = "20260617_1310"
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
        "finance_rate_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_finance_rate_snapshots")),
        schema=schema_name,
    )
    op.create_index(
        "ix_finance_rate_snapshots_captured",
        "finance_rate_snapshots",
        ["captured_at"],
        schema=schema_name,
    )

    op.create_table(
        "finance_rate_snapshot_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rate_snapshot_id", sa.Uuid(), nullable=False),
        sa.Column("base_currency", sa.String(length=16), nullable=False),
        sa.Column("quote_currency", sa.String(length=16), nullable=False),
        sa.Column("rate", sa.Numeric(28, 12), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_derived", sa.Boolean(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["rate_snapshot_id"],
            [_qualified_column(schema_name, "finance_rate_snapshots", "id")],
            name=op.f("fk_finance_rate_snapshot_entries_rate_snapshot_id_finance_rate_snapshots"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_finance_rate_snapshot_entries")),
        schema=schema_name,
    )
    op.create_index(
        "ix_finance_rate_snapshot_entries_rate_snapshot_id",
        "finance_rate_snapshot_entries",
        ["rate_snapshot_id"],
        schema=schema_name,
    )
    op.create_index(
        "ix_finance_rate_snapshot_entries_base",
        "finance_rate_snapshot_entries",
        ["base_currency"],
        schema=schema_name,
    )
    op.create_index(
        "uq_finance_rate_snapshot_entries_pair_active",
        "finance_rate_snapshot_entries",
        ["rate_snapshot_id", "base_currency", "quote_currency"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )

    with op.batch_alter_table("finance_snapshots", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("rate_snapshot_id", sa.Uuid(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "rate_snapshot_policy",
                sa.String(length=32),
                nullable=False,
                server_default="none",
            )
        )
        batch_op.create_foreign_key(
            op.f("fk_finance_snapshots_rate_snapshot_id_finance_rate_snapshots"),
            "finance_rate_snapshots",
            ["rate_snapshot_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_finance_snapshots_rate_snapshot", ["rate_snapshot_id"])

    with op.batch_alter_table("finance_snapshots", schema=schema_name) as batch_op:
        batch_op.alter_column("rate_snapshot_policy", server_default=None)


def downgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("finance_snapshots", schema=schema_name) as batch_op:
        batch_op.drop_index("ix_finance_snapshots_rate_snapshot")
        batch_op.drop_constraint(
            op.f("fk_finance_snapshots_rate_snapshot_id_finance_rate_snapshots"),
            type_="foreignkey",
        )
        batch_op.drop_column("rate_snapshot_policy")
        batch_op.drop_column("rate_snapshot_id")

    op.drop_index(
        "uq_finance_rate_snapshot_entries_pair_active",
        table_name="finance_rate_snapshot_entries",
        schema=schema_name,
    )
    op.drop_index(
        "ix_finance_rate_snapshot_entries_base",
        table_name="finance_rate_snapshot_entries",
        schema=schema_name,
    )
    op.drop_index(
        "ix_finance_rate_snapshot_entries_rate_snapshot_id",
        table_name="finance_rate_snapshot_entries",
        schema=schema_name,
    )
    op.drop_table("finance_rate_snapshot_entries", schema=schema_name)
    op.drop_index(
        "ix_finance_rate_snapshots_captured",
        table_name="finance_rate_snapshots",
        schema=schema_name,
    )
    op.drop_table("finance_rate_snapshots", schema=schema_name)
