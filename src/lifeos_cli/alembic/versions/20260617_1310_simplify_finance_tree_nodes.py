"""Remove obsolete finance tree node classification fields."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260617_1310"
down_revision = "20260617_1300"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def _finance_node_columns(schema_name: str | None) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {
        column["name"]
        for column in inspector.get_columns("finance_tree_nodes", schema=schema_name)
    }


def upgrade() -> None:
    schema_name = _schema_name()
    existing_columns = _finance_node_columns(schema_name)
    columns_to_drop = [
        column_name
        for column_name in ("node_kind", "normal_side")
        if column_name in existing_columns
    ]
    if not columns_to_drop:
        return

    with op.batch_alter_table("finance_tree_nodes", schema=schema_name) as batch_op:
        for column_name in columns_to_drop:
            batch_op.drop_column(column_name)


def downgrade() -> None:
    schema_name = _schema_name()
    existing_columns = _finance_node_columns(schema_name)
    with op.batch_alter_table("finance_tree_nodes", schema=schema_name) as batch_op:
        if "node_kind" not in existing_columns:
            batch_op.add_column(
                sa.Column(
                    "node_kind",
                    sa.String(length=20),
                    nullable=False,
                    server_default="regular",
                )
            )
        if "normal_side" not in existing_columns:
            batch_op.add_column(sa.Column("normal_side", sa.String(length=20), nullable=True))

    if "node_kind" not in existing_columns:
        with op.batch_alter_table("finance_tree_nodes", schema=schema_name) as batch_op:
            batch_op.alter_column("node_kind", server_default=None)
