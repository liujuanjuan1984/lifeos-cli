"""Helpers for generic weak entity-to-entity associations."""

from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.association import Association
from lifeos_cli.db.models.note import Note
from lifeos_cli.db.models.person import Person
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.models.timelog import Timelog

VALID_ASSOCIATION_MODELS = frozenset({"note", "person", "task", "timelog"})
VALID_ASSOCIATION_LINK_TYPES = frozenset({"is_about", "relates_to", "captured_from"})

MODEL_MAP: dict[str, Any] = {
    "note": Note,
    "person": Person,
    "task": Task,
    "timelog": Timelog,
}


def validate_association_model(model_name: str) -> str:
    """Validate one weak-association model name."""
    normalized = model_name.strip().lower()
    if normalized not in VALID_ASSOCIATION_MODELS:
        allowed = ", ".join(sorted(VALID_ASSOCIATION_MODELS))
        raise ValueError(f"Unsupported association model {normalized!r}. Expected one of: {allowed}")
    return normalized


def validate_association_link_type(link_type: str) -> str:
    """Validate one weak-association link type."""
    normalized = link_type.strip().lower()
    if normalized not in VALID_ASSOCIATION_LINK_TYPES:
        allowed = ", ".join(sorted(VALID_ASSOCIATION_LINK_TYPES))
        raise ValueError(
            f"Unsupported association link type {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def _deduplicate_ids(identifiers: list[UUID]) -> list[UUID]:
    return list(dict.fromkeys(identifiers))


async def _load_existing_ids(
    session: AsyncSession,
    *,
    model_name: str,
    identifiers: list[UUID],
) -> set[UUID]:
    if not identifiers:
        return set()
    model_cls = MODEL_MAP[validate_association_model(model_name)]
    stmt = select(model_cls.id).where(model_cls.id.in_(identifiers), model_cls.deleted_at.is_(None))
    rows = await session.execute(stmt)
    return set(rows.scalars().all())


async def set_association_links(
    session: AsyncSession,
    *,
    source_model: str,
    source_id: UUID,
    target_model: str,
    target_ids: list[UUID],
    link_type: str,
    replace: bool = True,
) -> None:
    """Create or replace weak links after validating both endpoints exist."""
    normalized_source_model = validate_association_model(source_model)
    normalized_target_model = validate_association_model(target_model)
    normalized_link_type = validate_association_link_type(link_type)
    unique_target_ids = _deduplicate_ids(target_ids)

    if source_id not in await _load_existing_ids(
        session,
        model_name=normalized_source_model,
        identifiers=[source_id],
    ):
        raise LookupError(
            f"Unknown source ID for association {normalized_source_model}: {source_id}"
        )

    existing_target_ids = await _load_existing_ids(
        session,
        model_name=normalized_target_model,
        identifiers=unique_target_ids,
    )
    missing_target_ids = [str(target_id) for target_id in unique_target_ids if target_id not in existing_target_ids]
    if missing_target_ids:
        raise LookupError(
            "Unknown target IDs for association "
            f"{normalized_source_model}->{normalized_target_model}: {', '.join(missing_target_ids)}"
        )

    if replace:
        await session.execute(
            delete(Association).where(
                Association.source_model == normalized_source_model,
                Association.source_id == source_id,
                Association.target_model == normalized_target_model,
                Association.link_type == normalized_link_type,
            )
        )

    existing_links: set[UUID] = set()
    if existing_target_ids and not replace:
        stmt = select(Association.target_id).where(
            Association.source_model == normalized_source_model,
            Association.source_id == source_id,
            Association.target_model == normalized_target_model,
            Association.target_id.in_(existing_target_ids),
            Association.link_type == normalized_link_type,
        )
        rows = await session.execute(stmt)
        existing_links = set(rows.scalars().all())

    for target_id in unique_target_ids:
        if target_id in existing_links:
            continue
        session.add(
            Association(
                source_model=normalized_source_model,
                source_id=source_id,
                target_model=normalized_target_model,
                target_id=target_id,
                link_type=normalized_link_type,
            )
        )


async def get_target_ids_for_sources(
    session: AsyncSession,
    *,
    source_model: str,
    source_ids: list[UUID],
    target_model: str,
    link_type: str | None = None,
) -> dict[UUID, list[UUID]]:
    """Return mapping source_id -> target_ids for one weak link family."""
    if not source_ids:
        return {}
    normalized_source_model = validate_association_model(source_model)
    normalized_target_model = validate_association_model(target_model)
    stmt = select(Association.source_id, Association.target_id).where(
        Association.source_model == normalized_source_model,
        Association.source_id.in_(source_ids),
        Association.target_model == normalized_target_model,
    ).order_by(Association.created_at.asc(), Association.id.asc())
    if link_type is not None:
        stmt = stmt.where(Association.link_type == validate_association_link_type(link_type))
    rows = await session.execute(stmt)
    mapping: dict[UUID, list[UUID]] = defaultdict(list)
    for source_id, target_id in rows.all():
        mapping[source_id].append(target_id)
    return dict(mapping)


async def get_source_ids_for_target(
    session: AsyncSession,
    *,
    source_model: str,
    target_model: str,
    target_id: UUID,
    link_type: str | None = None,
) -> list[UUID]:
    """Return linked source identifiers for one weak-link target."""
    normalized_source_model = validate_association_model(source_model)
    normalized_target_model = validate_association_model(target_model)
    stmt = select(Association.source_id).where(
        Association.source_model == normalized_source_model,
        Association.target_model == normalized_target_model,
        Association.target_id == target_id,
    ).order_by(Association.created_at.asc(), Association.id.asc())
    if link_type is not None:
        stmt = stmt.where(Association.link_type == validate_association_link_type(link_type))
    rows = await session.execute(stmt)
    return list(rows.scalars().all())


async def count_sources_for_targets(
    session: AsyncSession,
    *,
    source_model: str,
    target_model: str,
    target_ids: list[UUID],
    link_type: str | None = None,
) -> dict[UUID, int]:
    """Return mapping target_id -> linked source count."""
    if not target_ids:
        return {}
    normalized_source_model = validate_association_model(source_model)
    normalized_target_model = validate_association_model(target_model)
    stmt = (
        select(Association.target_id, func.count(Association.id))
        .where(
            Association.source_model == normalized_source_model,
            Association.target_model == normalized_target_model,
            Association.target_id.in_(target_ids),
        )
        .group_by(Association.target_id)
    )
    if link_type is not None:
        stmt = stmt.where(Association.link_type == validate_association_link_type(link_type))
    rows = await session.execute(stmt)
    return {target_id: count for target_id, count in rows.all()}


async def load_people_for_sources(
    session: AsyncSession,
    *,
    source_model: str,
    source_ids: list[UUID],
    link_type: str,
) -> dict[UUID, list[Person]]:
    """Load people grouped by source identifier."""
    mapping = await get_target_ids_for_sources(
        session,
        source_model=source_model,
        source_ids=source_ids,
        target_model="person",
        link_type=link_type,
    )
    all_person_ids = {person_id for person_ids in mapping.values() for person_id in person_ids}
    if not all_person_ids:
        return {}
    stmt = select(Person).where(Person.id.in_(all_person_ids), Person.deleted_at.is_(None))
    rows = await session.execute(stmt)
    people_by_id = {person.id: person for person in rows.scalars().all()}
    return {
        source_id: [people_by_id[person_id] for person_id in person_ids if person_id in people_by_id]
        for source_id, person_ids in mapping.items()
    }


async def load_tasks_for_sources(
    session: AsyncSession,
    *,
    source_model: str,
    source_ids: list[UUID],
    link_type: str,
) -> dict[UUID, Task]:
    """Load one linked task per source identifier."""
    mapping = await get_target_ids_for_sources(
        session,
        source_model=source_model,
        source_ids=source_ids,
        target_model="task",
        link_type=link_type,
    )
    all_task_ids = {task_id for task_ids in mapping.values() for task_id in task_ids}
    if not all_task_ids:
        return {}
    stmt = select(Task).where(Task.id.in_(all_task_ids), Task.deleted_at.is_(None))
    rows = await session.execute(stmt)
    tasks_by_id = {task.id: task for task in rows.scalars().all()}
    loaded: dict[UUID, Task] = {}
    for source_id, task_ids in mapping.items():
        for task_id in task_ids:
            task = tasks_by_id.get(task_id)
            if task is not None:
                loaded[source_id] = task
                break
    return loaded


async def load_timelogs_for_sources(
    session: AsyncSession,
    *,
    source_model: str,
    source_ids: list[UUID],
    link_type: str,
) -> dict[UUID, list[Timelog]]:
    """Load timelogs grouped by source identifier."""
    mapping = await get_target_ids_for_sources(
        session,
        source_model=source_model,
        source_ids=source_ids,
        target_model="timelog",
        link_type=link_type,
    )
    all_timelog_ids = {timelog_id for timelog_ids in mapping.values() for timelog_id in timelog_ids}
    if not all_timelog_ids:
        return {}
    stmt = select(Timelog).where(Timelog.id.in_(all_timelog_ids), Timelog.deleted_at.is_(None))
    rows = await session.execute(stmt)
    timelogs_by_id = {timelog.id: timelog for timelog in rows.scalars().all()}
    return {
        source_id: [
            timelogs_by_id[timelog_id]
            for timelog_id in timelog_ids
            if timelog_id in timelogs_by_id
        ]
        for source_id, timelog_ids in mapping.items()
    }


async def load_notes_for_targets(
    session: AsyncSession,
    *,
    target_model: str,
    target_ids: list[UUID],
    link_type: str,
) -> dict[UUID, list[Note]]:
    """Load notes grouped by target identifier."""
    if not target_ids:
        return {}
    normalized_target_model = validate_association_model(target_model)
    normalized_link_type = validate_association_link_type(link_type)
    stmt = select(Association.target_id, Association.source_id).where(
        Association.source_model == "note",
        Association.target_model == normalized_target_model,
        Association.target_id.in_(target_ids),
        Association.link_type == normalized_link_type,
    ).order_by(Association.created_at.asc(), Association.id.asc())
    rows = await session.execute(stmt)
    reverse_mapping: dict[UUID, list[UUID]] = defaultdict(list)
    for target_id, note_id in rows.all():
        reverse_mapping[target_id].append(note_id)
    all_note_ids = {note_id for note_ids in reverse_mapping.values() for note_id in note_ids}
    if not all_note_ids:
        return {}
    note_stmt = (
        select(Note)
        .where(Note.id.in_(all_note_ids), Note.deleted_at.is_(None))
        .order_by(Note.created_at.desc(), Note.id.desc())
    )
    rows = await session.execute(note_stmt)
    notes_by_id = {note.id: note for note in rows.scalars().all()}
    return {
        target_id: [notes_by_id[note_id] for note_id in note_ids if note_id in notes_by_id]
        for target_id, note_ids in reverse_mapping.items()
    }
