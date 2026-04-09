from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.cli import build_parser


def test_cli_parser_uses_lifeos_command_name() -> None:
    parser = build_parser()

    assert parser.prog == "lifeos"


def test_cli_parser_supports_note_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "add", "a new note"])

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.content == "a new note"


def test_cli_top_level_help_describes_command_grammar(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--help"])

    captured = capsys.readouterr()

    assert "lifeos <resource> <action> [arguments] [options]" in captured.out
    assert "resources:" in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_main_note_without_action_prints_resource_help(capsys) -> None:
    exit_code = cli.main(["note"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Create, inspect, update, and delete note records." in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_cli_note_list_help_explains_output_shape(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "list", "--help"])

    captured = capsys.readouterr()

    assert "The output is tab-separated" in captured.out
    assert "Use --limit and --offset together for pagination." in captured.out


def test_main_note_add_creates_note(monkeypatch, capsys) -> None:
    created: dict[str, str] = {}

    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_note(session: object, *, content: str) -> object:
        created["content"] = content
        return SimpleNamespace(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            content=content,
            created_at=datetime(2026, 4, 9, tzinfo=timezone.utc),
            deleted_at=None,
        )

    monkeypatch.setattr(cli, "session_scope", fake_session_scope)
    monkeypatch.setattr(cli, "create_note", fake_create_note)

    exit_code = cli.main(["note", "add", "a new note"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert created["content"] == "a new note"
    assert "Created note 11111111-1111-1111-1111-111111111111" in captured.out


def test_main_note_list_prints_formatted_notes(monkeypatch, capsys) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_list_notes(
        session: object,
        *,
        include_deleted: bool,
        limit: int,
        offset: int,
    ) -> list[object]:
        assert include_deleted is False
        assert limit == 100
        assert offset == 0
        return [
            SimpleNamespace(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                content="first note",
                created_at=datetime(2026, 4, 9, 1, 2, 3, tzinfo=timezone.utc),
                deleted_at=None,
            )
        ]

    monkeypatch.setattr(cli, "session_scope", fake_session_scope)
    monkeypatch.setattr(cli, "list_notes", fake_list_notes)

    exit_code = cli.main(["note", "list"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert (
        "22222222-2222-2222-2222-222222222222\tactive\t2026-04-09T01:02:03+00:00\tfirst note"
        in captured.out
    )


def test_main_note_delete_reports_missing_note(monkeypatch, capsys) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_delete_note(
        session: object,
        *,
        note_id: UUID,
        hard_delete: bool,
    ) -> None:
        raise cli.NoteNotFoundError(f"Note {note_id} was not found")

    monkeypatch.setattr(cli, "session_scope", fake_session_scope)
    monkeypatch.setattr(cli, "delete_note", fake_delete_note)

    exit_code = cli.main(["note", "delete", "33333333-3333-3333-3333-333333333333"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Note 33333333-3333-3333-3333-333333333333 was not found" in captured.err
