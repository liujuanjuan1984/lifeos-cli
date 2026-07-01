from __future__ import annotations

import asyncio
import warnings
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from sqlalchemy.exc import SAWarning
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from lifeos_cli.db.base import Base
from lifeos_cli.db.services import notes, people, tags


async def _create_sqlite_session_factory() -> tuple[
    AsyncEngine,
    async_sessionmaker[AsyncSession],
]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False, future=True)


def test_create_note_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=AsyncMock(),
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    def fake_add(_: object) -> None:
        pass

    async def fake_build_note_view(_: object, note: object) -> object:
        return note

    session.add = fake_add
    monkeypatch.setattr(notes, "_build_note_view", fake_build_note_view)

    note = asyncio.run(notes.create_note(cast(Any, session), content="hello"))

    assert note.content == "hello"
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(note)
    session.commit.assert_not_called()


def test_list_notes_by_tag_does_not_emit_cartesian_product_warning() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tag = await tags.create_tag(
                    session,
                    name="Project",
                    entity_type="note",
                    category="general",
                )
                created_note = await notes.create_note(
                    session,
                    content="Tagged note",
                    tag_ids=[tag.id],
                )

                with warnings.catch_warnings(record=True) as caught:
                    warnings.simplefilter("always", SAWarning)
                    rows = await notes.list_notes(session, tag_id=tag.id)

                assert [row.id for row in rows] == [created_note.id]
                assert not any(
                    issubclass(item.category, SAWarning)
                    and "cartesian product" in str(item.message)
                    for item in caught
                )
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_count_note_usage_by_person_counts_active_notes() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                person = await people.create_person(session, name="Alice")
                active_note = await notes.create_note(
                    session,
                    content="Active note",
                    person_ids=[person.id],
                )
                deleted_note = await notes.create_note(
                    session,
                    content="Deleted note",
                    person_ids=[person.id],
                )
                await notes.delete_note(session, note_id=deleted_note.id)

                stats = await notes.count_note_usage_by_person(session)

                assert active_note.people[0].id == person.id
                assert [(row.id, row.name, row.display_name, row.usage_count) for row in stats] == [
                    (person.id, "Alice", "Alice", 1),
                ]
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_batch_update_note_content_does_not_rollback_missing_note(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target_id = UUID("11111111-1111-1111-1111-111111111111")
    missing_id = UUID("22222222-2222-2222-2222-222222222222")
    session = SimpleNamespace(
        flush=AsyncMock(),
        refresh=AsyncMock(),
        rollback=AsyncMock(),
    )
    existing_note = SimpleNamespace(id=target_id, content="draft value")

    async def fake_get_note_model(*_: object, note_id: UUID, **__: object) -> object | None:
        if note_id == target_id:
            return existing_note
        return None

    monkeypatch.setattr(notes, "_get_note_model", fake_get_note_model)

    result = asyncio.run(
        notes.batch_update_note_content(
            cast(Any, session),
            note_ids=[target_id, missing_id],
            find_text="draft",
            replace_text="final",
        )
    )

    assert result.updated_count == 1
    assert result.failed_ids == (missing_id,)
    assert existing_note.content == "final value"
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(existing_note)
    session.rollback.assert_not_called()
