from __future__ import annotations

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


def test_cli_parser_supports_note_add_from_stdin() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "add", "--stdin"])

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.stdin is True
    assert args.content is None


def test_cli_parser_supports_note_show_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "show", "11111111-1111-1111-1111-111111111111"])

    assert args.resource == "note"
    assert args.note_command == "show"
    assert str(args.note_id) == "11111111-1111-1111-1111-111111111111"


def test_cli_parser_supports_note_search_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "search", "meeting notes", "--limit", "20"])

    assert args.resource == "note"
    assert args.note_command == "search"
    assert args.query == "meeting notes"
    assert args.limit == 20


def test_cli_parser_supports_note_batch_update_content_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "batch",
            "update-content",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
            "--find-text",
            "draft",
            "--replace-text",
            "final",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "batch"
    assert args.note_batch_command == "update-content"
    assert args.find_text == "draft"
    assert args.replace_text == "final"
    assert len(args.note_ids) == 2


def test_cli_top_level_help_describes_command_grammar(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--help"])

    captured = capsys.readouterr()

    assert "lifeos <resource> <action> [arguments] [options]" in captured.out
    assert "resources:" in captured.out
    assert "init      Initialize local configuration" in captured.out
    assert "people    Manage people and relationships" in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_cli_parser_supports_area_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["area", "add", "Health", "--display-order", "2"])

    assert args.resource == "area"
    assert args.area_command == "add"
    assert args.name == "Health"
    assert args.display_order == 2


def test_cli_parser_supports_people_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["people", "add", "Alice", "--nickname", "ally"])

    assert args.resource == "people"
    assert args.people_command == "add"
    assert args.name == "Alice"
    assert args.nickname == ["ally"]


def test_cli_parser_supports_task_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "add",
            "Draft release checklist",
            "--vision-id",
            "11111111-1111-1111-1111-111111111111",
            "--priority",
            "3",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "add"
    assert args.content == "Draft release checklist"
    assert str(args.vision_id) == "11111111-1111-1111-1111-111111111111"
    assert args.priority == 3


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


def test_cli_note_batch_help_explains_namespace_intent(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "batch", "--help"])

    captured = capsys.readouterr()

    assert "Run operations that target multiple notes in a single command." in captured.out
    assert "update-content" in captured.out
    assert "delete" in captured.out
