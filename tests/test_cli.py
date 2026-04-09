from __future__ import annotations

import builtins
import io
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy.exc import OperationalError

from lifeos_cli import cli
from lifeos_cli.cli import build_parser
from lifeos_cli.config import clear_config_cache
from lifeos_cli.db import services as db_services
from lifeos_cli.db import session as db_session


def test_cli_parser_uses_lifeos_command_name() -> None:
    parser = build_parser()

    assert parser.prog == "lifeos"


def test_cli_parser_supports_note_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "add", "a new note"])

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.content == "a new note"


def test_cli_parser_supports_note_add_from_stdin() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "add", "--stdin"])

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.stdin is True
    assert args.content is None


def test_cli_top_level_help_describes_command_grammar(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--help"])

    captured = capsys.readouterr()

    assert "lifeos <resource> <action> [arguments] [options]" in captured.out
    assert "resources:" in captured.out
    assert "init      Initialize local configuration" in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_main_note_without_action_prints_resource_help(capsys) -> None:
    exit_code = cli.main(["note"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Create, inspect, update, and delete note records." in captured.out
    assert "Run `lifeos init` before using note commands for the first time." in captured.out


def test_cli_note_list_help_explains_output_shape(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "list", "--help"])

    captured = capsys.readouterr()

    assert "The output is tab-separated" in captured.out
    assert "Use --limit and --offset together for pagination." in captured.out


def test_main_init_non_interactive_writes_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(cli, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(cli, "_handle_db_ping_async", lambda _: _async_zero())

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    assert "Database URL: postgresql+psycopg://db-user:***@localhost:5432/lifeos" in captured.out
    content = config_path.read_text(encoding="utf-8")
    assert 'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"' in content
    clear_config_cache()


def test_main_init_does_not_prompt_for_explicit_database_url(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    prompts: list[str] = []
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(cli, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(cli, "_handle_db_ping_async", lambda _: _async_zero())
    monkeypatch.setattr(cli.sys.stdin, "isatty", lambda: True)

    def fake_input(prompt: str) -> str:
        prompts.append(prompt)
        if prompt.startswith("Database schema"):
            return ""
        if prompt.startswith("Enable SQL echo logging"):
            return ""
        raise AssertionError(f"unexpected prompt: {prompt}")

    monkeypatch.setattr(builtins, "input", fake_input)

    exit_code = cli.main(
        [
            "init",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    assert all(not prompt.startswith("Database URL") for prompt in prompts)
    assert any(prompt.startswith("Database schema") for prompt in prompts)
    clear_config_cache()


def test_main_init_reprompts_invalid_schema_in_interactive_mode(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    prompts: list[str] = []
    responses = iter(["lifeos-dev", "lifeos_dev", ""])
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(cli, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(cli, "_handle_db_ping_async", lambda _: _async_zero())
    monkeypatch.setattr(cli.sys.stdin, "isatty", lambda: True)

    def fake_input(prompt: str) -> str:
        prompts.append(prompt)
        return next(responses)

    monkeypatch.setattr(builtins, "input", fake_input)

    exit_code = cli.main(
        [
            "init",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
            "--skip-ping",
            "--skip-migrate",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "lifeos_dev" in config_path.read_text(encoding="utf-8")
    assert "Use `lifeos_dev` instead of `lifeos-dev`." in captured.err
    assert sum(prompt.startswith("Database schema") for prompt in prompts) == 2
    clear_config_cache()


def test_main_init_rejects_invalid_schema_non_interactively(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
            "--schema",
            "lifeos-dev",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use `lifeos_dev` instead of `lifeos-dev`." in captured.err
    assert not config_path.exists()
    clear_config_cache()


def test_main_config_show_masks_database_password(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"',
                'schema = "lifeos"',
                "echo = false",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    exit_code = cli.main(["config", "show"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Database URL: postgresql+psycopg://db-user:***@localhost:5432/lifeos" in captured.out
    assert "<db-password>" not in captured.out
    clear_config_cache()


def test_main_init_can_repair_invalid_existing_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"',
                'schema = ""',
                "echo = false",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setattr(cli, "_handle_db_upgrade", lambda _: 0)
    monkeypatch.setattr(cli, "_handle_db_ping_async", lambda _: _async_zero())

    exit_code = cli.main(
        [
            "init",
            "--non-interactive",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Wrote config file:" in captured.out
    rewritten = config_path.read_text(encoding="utf-8")
    assert 'schema = "lifeos"' in rewritten
    clear_config_cache()


def test_main_note_add_creates_note(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
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

    monkeypatch.setattr(db_session, "session_scope", fake_session_scope)
    monkeypatch.setattr(db_services, "create_note", fake_create_note)

    exit_code = cli.main(["note", "add", "a new note"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert created["content"] == "a new note"
    assert "Created note 11111111-1111-1111-1111-111111111111" in captured.out


def test_main_note_add_reads_multiline_content_from_stdin(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    created: dict[str, str] = {}

    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_note(session: object, *, content: str) -> object:
        created["content"] = content
        return SimpleNamespace(
            id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            content=content,
            created_at=datetime(2026, 4, 9, tzinfo=timezone.utc),
            deleted_at=None,
        )

    monkeypatch.setattr(db_session, "session_scope", fake_session_scope)
    monkeypatch.setattr(db_services, "create_note", fake_create_note)
    monkeypatch.setattr(cli.sys, "stdin", io.StringIO("line one\nline two\n"))

    exit_code = cli.main(["note", "add", "--stdin"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert created["content"] == "line one\nline two"
    assert "Created note aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" in captured.out


def test_main_note_add_reads_content_from_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    created: dict[str, str] = {}
    content_file = tmp_path / "note.md"
    content_file.write_text("first line\nsecond line\n", encoding="utf-8")

    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_note(session: object, *, content: str) -> object:
        created["content"] = content
        return SimpleNamespace(
            id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            content=content,
            created_at=datetime(2026, 4, 9, tzinfo=timezone.utc),
            deleted_at=None,
        )

    monkeypatch.setattr(db_session, "session_scope", fake_session_scope)
    monkeypatch.setattr(db_services, "create_note", fake_create_note)

    exit_code = cli.main(["note", "add", "--file", str(content_file)])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert created["content"] == "first line\nsecond line"
    assert "Created note bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" in captured.out


def test_main_note_add_requires_exactly_one_content_source(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(Path("/tmp") / "missing-config.toml"))

    exit_code = cli.main(["note", "add", "inline text", "--stdin"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "exactly one source" in captured.err


def test_main_note_list_prints_formatted_notes(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
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

    monkeypatch.setattr(db_session, "session_scope", fake_session_scope)
    monkeypatch.setattr(db_services, "list_notes", fake_list_notes)

    exit_code = cli.main(["note", "list"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert (
        "22222222-2222-2222-2222-222222222222\tactive\t2026-04-09T01:02:03+00:00\tfirst note"
        in captured.out
    )


def test_main_note_delete_reports_missing_note(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_delete_note(
        session: object,
        *,
        note_id: UUID,
        hard_delete: bool,
    ) -> None:
        raise db_services.NoteNotFoundError(f"Note {note_id} was not found")

    monkeypatch.setattr(db_session, "session_scope", fake_session_scope)
    monkeypatch.setattr(db_services, "delete_note", fake_delete_note)

    exit_code = cli.main(["note", "delete", "33333333-3333-3333-3333-333333333333"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Note 33333333-3333-3333-3333-333333333333 was not found" in captured.err


def test_main_note_add_prints_actionable_database_error(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(tmp_path / "missing-config.toml"))
    monkeypatch.delenv("LIFEOS_DATABASE_URL", raising=False)

    exit_code = cli.main(["note", "add", "a new note"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Run `lifeos init`" in captured.err


def test_main_note_add_prints_actionable_authentication_guidance(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        "\n".join(
            (
                "[database]",
                'url = "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"',
                'schema = "lifeos"',
                "echo = false",
                "",
            )
        ),
        encoding="utf-8",
    )
    clear_config_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))

    @asynccontextmanager
    async def fake_session_scope():
        yield object()

    async def fake_create_note(session: object, *, content: str) -> object:
        raise OperationalError(
            statement=None,
            params=None,
            orig=RuntimeError("password authentication failed"),
        )

    monkeypatch.setattr(db_session, "session_scope", fake_session_scope)
    monkeypatch.setattr(db_services, "create_note", fake_create_note)

    exit_code = cli.main(["note", "add", "a new note"])
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Authentication failed." in captured.err
    clear_config_cache()


async def _async_zero() -> int:
    return 0
