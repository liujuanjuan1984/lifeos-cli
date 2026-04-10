"""Remove area person associations."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260410_0900"
down_revision = "20260409_1400"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()
    op.execute(
        sa.text(
            f'DELETE FROM "{schema_name}"."person_associations" '
            "WHERE entity_type = :entity_type"
        ).bindparams(entity_type="area")
    )


def downgrade() -> None:
    # Historical area-person links cannot be reconstructed after deletion.
    pass
