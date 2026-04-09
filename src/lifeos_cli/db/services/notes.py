"""Async CRUD helpers for notes."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.note import Note
from lifeos_cli.db.transaction import commit_or_rollback


class NoteNotFoundError(LookupError):
    """Raised when a note cannot be found."""


def _note_query(*, include_deleted: bool) -> Select[tuple[Note]]:
    stmt = select(Note)
    if not include_deleted:
        stmt = stmt.where(Note.deleted_at.is_(None))
    return stmt


async def create_note(session: AsyncSession, *, content: str) -> Note:
    """Create and persist a note."""
    note = Note(content=content)
    session.add(note)
    await commit_or_rollback(session)
    await session.refresh(note)
    return note


async def get_note(
    session: AsyncSession,
    *,
    note_id: UUID,
    include_deleted: bool = False,
) -> Note | None:
    """Fetch a note by identifier."""
    stmt = _note_query(include_deleted=include_deleted).where(Note.id == note_id).limit(1)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_notes(
    session: AsyncSession,
    *,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Note]:
    """Return notes ordered from newest to oldest."""
    stmt = (
        _note_query(include_deleted=include_deleted)
        .order_by(Note.created_at.desc(), Note.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def update_note(session: AsyncSession, *, note_id: UUID, content: str) -> Note:
    """Update note content."""
    note = await get_note(session, note_id=note_id)
    if note is None:
        raise NoteNotFoundError(f"Note {note_id} was not found")
    note.content = content
    await commit_or_rollback(session)
    await session.refresh(note)
    return note


async def delete_note(
    session: AsyncSession,
    *,
    note_id: UUID,
    hard_delete: bool = False,
) -> None:
    """Delete a note either softly or permanently."""
    note = await get_note(session, note_id=note_id, include_deleted=hard_delete)
    if note is None:
        raise NoteNotFoundError(f"Note {note_id} was not found")
    if hard_delete:
        await session.delete(note)
    else:
        note.soft_delete()
    await commit_or_rollback(session)
