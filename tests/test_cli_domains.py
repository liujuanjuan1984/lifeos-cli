from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.cli_support import (
    area_handlers,
    people_handlers,
    tag_handlers,
    task_handlers,
    vision_handlers,
)


def test_main_area_add_creates_area(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_area(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "Health"
        return SimpleNamespace(id=UUID("11111111-1111-1111-1111-111111111111"))

    monkeypatch.setattr(area_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(area_handlers, "create_area", fake_create_area)

    exit_code = cli.main(["area", "add", "Health"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created area 11111111-1111-1111-1111-111111111111" in captured.out


def test_main_tag_add_creates_tag(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_tag(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "family"
        assert kwargs["entity_type"] == "person"
        return SimpleNamespace(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(tag_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(tag_handlers, "create_tag", fake_create_tag)

    exit_code = cli.main(["tag", "add", "family", "--entity-type", "person"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created tag 22222222-2222-2222-2222-222222222222" in captured.out


def test_main_people_show_prints_tags(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_get_person(
        session: object,
        *,
        person_id: UUID,
        include_deleted: bool,
    ) -> object:
        return SimpleNamespace(
            id=person_id,
            name="Alice",
            description="Friend",
            nicknames=["ally"],
            birth_date=None,
            location="Toronto",
            tags=[SimpleNamespace(name="family"), SimpleNamespace(name="friend")],
            created_at=datetime(2026, 4, 9, tzinfo=timezone.utc),
            updated_at=datetime(2026, 4, 9, tzinfo=timezone.utc),
            deleted_at=None,
        )

    monkeypatch.setattr(people_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(people_handlers, "get_person", fake_get_person)

    exit_code = cli.main(["people", "show", "33333333-3333-3333-3333-333333333333"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "name: Alice" in captured.out
    assert "tags: family, friend" in captured.out


def test_main_vision_add_creates_vision(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_vision(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "Launch lifeos-cli"
        return SimpleNamespace(id=UUID("44444444-4444-4444-4444-444444444444"))

    monkeypatch.setattr(vision_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(vision_handlers, "create_vision", fake_create_vision)

    exit_code = cli.main(["vision", "add", "Launch lifeos-cli"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created vision 44444444-4444-4444-4444-444444444444" in captured.out


def test_main_task_add_creates_task(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_task(session: object, **kwargs: object) -> object:
        assert kwargs["content"] == "Draft release checklist"
        assert kwargs["priority"] == 2
        return SimpleNamespace(id=UUID("55555555-5555-5555-5555-555555555555"))

    monkeypatch.setattr(task_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(task_handlers, "create_task", fake_create_task)

    exit_code = cli.main(
        [
            "task",
            "add",
            "Draft release checklist",
            "--vision-id",
            "66666666-6666-6666-6666-666666666666",
            "--priority",
            "2",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created task 55555555-5555-5555-5555-555555555555" in captured.out


def test_main_task_batch_delete_prints_summary(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_batch_delete_tasks(
        session: object,
        *,
        task_ids: list[UUID],
    ) -> object:
        assert task_ids == [
            UUID("11111111-1111-1111-1111-111111111111"),
            UUID("22222222-2222-2222-2222-222222222222"),
        ]
        return SimpleNamespace(
            deleted_count=2,
            failed_ids=(),
            errors=(),
        )

    monkeypatch.setattr(task_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(task_handlers, "batch_delete_tasks", fake_batch_delete_tasks)

    exit_code = cli.main(
        [
            "task",
            "batch",
            "delete",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Deleted tasks: 2" in captured.out


def test_main_people_batch_delete_reports_missing_ids(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_batch_delete_people(
        session: object,
        *,
        person_ids: list[UUID],
    ) -> object:
        assert person_ids == [UUID("33333333-3333-3333-3333-333333333333")]
        return SimpleNamespace(
            deleted_count=0,
            failed_ids=(UUID("33333333-3333-3333-3333-333333333333"),),
            errors=("Person 33333333-3333-3333-3333-333333333333 was not found",),
        )

    monkeypatch.setattr(people_handlers, "session_scope", fake_session_scope)
    monkeypatch.setattr(people_handlers, "batch_delete_people", fake_batch_delete_people)

    exit_code = cli.main(
        [
            "people",
            "batch",
            "delete",
            "--ids",
            "33333333-3333-3333-3333-333333333333",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Deleted people: 0" in captured.out
    assert "Failed person IDs" in captured.err
