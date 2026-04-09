from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.services import notes


def test_create_note_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=AsyncMock(),
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    def fake_add(note: object) -> None:
        session.added_note = note

    session.add = fake_add

    note = asyncio.run(notes.create_note(cast(Any, session), content="hello"))

    assert note.content == "hello"
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(note)
    session.commit.assert_not_called()


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

    async def fake_get_note(*_: object, note_id: UUID, **__: object) -> object | None:
        if note_id == target_id:
            return existing_note
        return None

    monkeypatch.setattr(notes, "get_note", fake_get_note)

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
