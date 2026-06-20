"""Add finance assets and pair-based rate snapshots."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "20260618_0900"
down_revision = "20260617_1320"
branch_labels = None
depends_on = None


DEFAULT_ASSETS = (
    ("USD", "US Dollar", 10),
    ("USDT", "Tether USD", 20),
    ("CNY", "Chinese Yuan", 30),
    ("BTC", "Bitcoin", 40),
    ("ETH", "Ethereum", 50),
    ("EUR", "Euro", 60),
)


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()
    op.create_table(
        "finance_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_finance_assets")),
        schema=schema_name,
    )
    op.create_index(
        "uq_finance_assets_code_active",
        "finance_assets",
        ["code"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_finance_assets_display_order",
        "finance_assets",
        ["display_order", "code"],
        schema=schema_name,
    )

    assets_table = sa.table(
        "finance_assets",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("display_order", sa.Integer()),
        sa.column("is_default", sa.Boolean()),
        sa.column("metadata", sa.JSON()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("deleted_at", sa.DateTime(timezone=True)),
        schema=schema_name,
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(
        assets_table,
        [
            {
                "id": uuid4(),
                "code": code,
                "name": name,
                "display_order": display_order,
                "is_default": True,
                "metadata": None,
                "created_at": now,
                "updated_at": now,
                "deleted_at": None,
            }
            for code, name, display_order in DEFAULT_ASSETS
        ],
    )


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(
        "ix_finance_assets_display_order",
        table_name="finance_assets",
        schema=schema_name,
    )
    op.drop_index(
        "uq_finance_assets_code_active",
        table_name="finance_assets",
        schema=schema_name,
    )
    op.drop_table("finance_assets", schema=schema_name)
