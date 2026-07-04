"""Move habit action notes into linked notes."""

from __future__ import annotations

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "20260704_1500"
down_revision = "20260704_1100"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def _model_constraint_values() -> str:
    return "'event', 'habit_action', 'note', 'person', 'task', 'timelog', 'vision'"


def _legacy_model_constraint_values() -> str:
    return "'event', 'note', 'person', 'task', 'timelog', 'vision'"


def _migrate_action_notes_to_notes(schema_name: str | None) -> None:
    connection = op.get_bind()
    habit_actions = sa.table(
        "habit_actions",
        sa.column("id", sa.Uuid()),
        sa.column("notes", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        schema=schema_name,
    )
    notes = sa.table(
        "notes",
        sa.column("id", sa.Uuid()),
        sa.column("content", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("deleted_at", sa.DateTime(timezone=True)),
        schema=schema_name,
    )
    associations = sa.table(
        "associations",
        sa.column("id", sa.Uuid()),
        sa.column("source_model", sa.String()),
        sa.column("source_id", sa.Uuid()),
        sa.column("target_model", sa.String()),
        sa.column("target_id", sa.Uuid()),
        sa.column("link_type", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        schema=schema_name,
    )

    rows = connection.execute(
        sa.select(
            habit_actions.c.id,
            habit_actions.c.notes,
            habit_actions.c.created_at,
            habit_actions.c.updated_at,
        ).where(
            habit_actions.c.notes.is_not(None),
            sa.func.trim(habit_actions.c.notes) != "",
        )
    ).all()
    for action_id, content, created_at, updated_at in rows:
        note_id = uuid4()
        association_id = uuid4()
        connection.execute(
            notes.insert().values(
                id=note_id,
                content=content,
                created_at=created_at,
                updated_at=updated_at,
                deleted_at=None,
            )
        )
        connection.execute(
            associations.insert().values(
                id=association_id,
                source_model="note",
                source_id=note_id,
                target_model="habit_action",
                target_id=action_id,
                link_type="captured_from",
                created_at=created_at,
                updated_at=updated_at,
            )
        )


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
            f"source_model IN ({_model_constraint_values()})",
        )
        batch_op.create_check_constraint(
            "ck_associations_target_model_valid",
            f"target_model IN ({_model_constraint_values()})",
        )

    _migrate_action_notes_to_notes(schema_name)

    with op.batch_alter_table("habit_actions", schema=schema_name) as batch_op:
        batch_op.drop_column("notes")


def downgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("habit_actions", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))

    connection = op.get_bind()
    associations = sa.table(
        "associations",
        sa.column("source_model", sa.String()),
        sa.column("source_id", sa.Uuid()),
        sa.column("target_model", sa.String()),
        sa.column("target_id", sa.Uuid()),
        sa.column("link_type", sa.String()),
        schema=schema_name,
    )
    notes = sa.table(
        "notes",
        sa.column("id", sa.Uuid()),
        sa.column("content", sa.Text()),
        sa.column("deleted_at", sa.DateTime(timezone=True)),
        schema=schema_name,
    )
    habit_actions = sa.table(
        "habit_actions",
        sa.column("id", sa.Uuid()),
        sa.column("notes", sa.Text()),
        schema=schema_name,
    )
    rows = connection.execute(
        sa.select(associations.c.target_id, notes.c.content)
        .select_from(associations.join(notes, notes.c.id == associations.c.source_id))
        .where(
            associations.c.source_model == "note",
            associations.c.target_model == "habit_action",
            associations.c.link_type == "captured_from",
            notes.c.deleted_at.is_(None),
        )
        .order_by(associations.c.target_id.asc(), associations.c.source_id.asc())
    ).all()
    grouped: dict[object, list[str]] = {}
    for action_id, content in rows:
        grouped.setdefault(action_id, []).append(content)
    for action_id, contents in grouped.items():
        connection.execute(
            habit_actions.update()
            .where(habit_actions.c.id == action_id)
            .values(notes="\n\n".join(contents))
        )
    connection.execute(
        associations.delete().where(
            associations.c.source_model == "note",
            associations.c.target_model == "habit_action",
            associations.c.link_type == "captured_from",
        )
    )

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
            f"source_model IN ({_legacy_model_constraint_values()})",
        )
        batch_op.create_check_constraint(
            "ck_associations_target_model_valid",
            f"target_model IN ({_legacy_model_constraint_values()})",
        )
