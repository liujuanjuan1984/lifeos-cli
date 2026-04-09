"""Async CRUD helpers for notes."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.note import Note
from lifeos_cli.db.transaction import commit_or_rollback


class NoteNotFoundError(LookupError):
    """Raised when a note cannot be found."""


@dataclass(frozen=True)
class NoteBatchUpdateResult:
    """Summary for a batch note content update operation."""

    updated_count: int
    unchanged_ids: tuple[UUID, ...]
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]
    replacement_count: int


@dataclass(frozen=True)
class NoteBatchDeleteResult:
    """Summary for a batch note delete operation."""

    deleted_count: int
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]


def _note_query(*, include_deleted: bool) -> Select[tuple[Note]]:
    stmt = select(Note)
    if not include_deleted:
        stmt = stmt.where(Note.deleted_at.is_(None))
    return stmt


def _deduplicate_note_ids(note_ids: list[UUID]) -> list[UUID]:
    """Return note identifiers in their original order without duplicates."""
    return list(dict.fromkeys(note_ids))


def _tokenize_search_query(query: str) -> list[str]:
    """Split a search query into normalized non-empty tokens."""
    return [token.strip() for token in query.split() if token.strip()]


def _apply_content_batch_operation(
    *,
    note: Note,
    find_text: str,
    replace_text: str,
    case_sensitive: bool,
) -> int:
    """Apply a content find/replace operation and return the number of replacements."""
    original = note.content
    if case_sensitive:
        replacements = original.count(find_text)
        if replacements:
            note.content = original.replace(find_text, replace_text)
        return replacements

    pattern = re.compile(re.escape(find_text), re.IGNORECASE)
    updated_content, replacements = pattern.subn(replace_text, original)
    if replacements:
        note.content = updated_content
    return replacements


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


async def search_notes(
    session: AsyncSession,
    *,
    query: str,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Note]:
    """Return notes whose content matches any token from the query."""
    tokens = _tokenize_search_query(query)
    stmt = _note_query(include_deleted=include_deleted)
    if tokens:
        stmt = stmt.where(or_(*[Note.content.ilike(f"%{token}%") for token in tokens]))
    stmt = stmt.order_by(Note.created_at.desc(), Note.id.desc()).offset(offset).limit(limit)
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


async def batch_update_note_content(
    session: AsyncSession,
    *,
    note_ids: list[UUID],
    find_text: str,
    replace_text: str = "",
    case_sensitive: bool = False,
) -> NoteBatchUpdateResult:
    """Apply a find/replace operation across multiple active notes."""
    updated_count = 0
    replacement_count = 0
    unchanged_ids: list[UUID] = []
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for note_id in _deduplicate_note_ids(note_ids):
        try:
            note = await get_note(session, note_id=note_id, include_deleted=False)
            if note is None:
                raise NoteNotFoundError(f"Note {note_id} was not found")
            replacements = _apply_content_batch_operation(
                note=note,
                find_text=find_text,
                replace_text=replace_text,
                case_sensitive=case_sensitive,
            )
            if replacements:
                await commit_or_rollback(session)
                await session.refresh(note)
                updated_count += 1
                replacement_count += replacements
            else:
                unchanged_ids.append(note_id)
        except NoteNotFoundError as exc:
            await session.rollback()
            failed_ids.append(note_id)
            errors.append(str(exc))

    return NoteBatchUpdateResult(
        updated_count=updated_count,
        unchanged_ids=tuple(unchanged_ids),
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
        replacement_count=replacement_count,
    )


async def batch_delete_notes(
    session: AsyncSession,
    *,
    note_ids: list[UUID],
    hard_delete: bool = False,
) -> NoteBatchDeleteResult:
    """Delete multiple notes while preserving per-note error reporting."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for note_id in _deduplicate_note_ids(note_ids):
        try:
            await delete_note(session, note_id=note_id, hard_delete=hard_delete)
            deleted_count += 1
        except NoteNotFoundError as exc:
            await session.rollback()
            failed_ids.append(note_id)
            errors.append(str(exc))

    return NoteBatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )
