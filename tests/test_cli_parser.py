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
    assert "init          Initialize local configuration" in captured.out
    assert "event         Manage planned schedule events" in captured.out
    assert "people        Manage people and relationships" in captured.out
    assert "habit-action  Manage dated habit actions" in captured.out
    assert "timelog       Manage actual time records" in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_cli_parser_supports_area_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "area",
            "add",
            "Health",
            "--display-order",
            "2",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )

    assert args.resource == "area"
    assert args.area_command == "add"
    assert args.name == "Health"
    assert args.display_order == 2
    assert len(args.person_ids) == 1


def test_cli_parser_supports_area_update_clear_icon_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "area",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-icon",
        ]
    )

    assert args.resource == "area"
    assert args.area_command == "update"
    assert args.clear_icon is True


def test_cli_parser_supports_event_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "event",
            "add",
            "Doctor appointment",
            "--start-time",
            "2026-04-10T09:00:00-04:00",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )

    assert args.resource == "event"
    assert args.event_command == "add"
    assert args.title == "Doctor appointment"
    assert len(args.person_ids) == 1


def test_cli_parser_supports_people_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["people", "add", "Alice", "--nickname", "ally"])

    assert args.resource == "people"
    assert args.people_command == "add"
    assert args.name == "Alice"
    assert args.nickname == ["ally"]


def test_cli_parser_supports_people_update_clear_location_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "people",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-location",
        ]
    )

    assert args.resource == "people"
    assert args.people_command == "update"
    assert args.clear_location is True


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


def test_cli_parser_supports_task_list_person_filter() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "list",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "list"
    assert str(args.person_id) == "11111111-1111-1111-1111-111111111111"


def test_cli_parser_supports_timelog_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "timelog",
            "add",
            "Deep work",
            "--start-time",
            "2026-04-10T13:00:00-04:00",
            "--end-time",
            "2026-04-10T14:30:00-04:00",
            "--tracking-method",
            "manual",
        ]
    )

    assert args.resource == "timelog"
    assert args.timelog_command == "add"
    assert args.title == "Deep work"
    assert args.tracking_method == "manual"


def test_cli_parser_supports_vision_update_clear_area_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "vision",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-area",
        ]
    )

    assert args.resource == "vision"
    assert args.vision_command == "update"
    assert args.clear_area is True


def test_cli_parser_supports_vision_update_clear_people_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "vision",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-people",
        ]
    )

    assert args.resource == "vision"
    assert args.vision_command == "update"
    assert args.clear_people is True


def test_cli_vision_update_help_lists_valid_statuses(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["vision", "update", "--help"])

    captured = capsys.readouterr()

    assert "active`, `archived`, and `fruit`" in captured.out
    assert "--status paused" not in captured.out


def test_cli_parser_supports_tag_update_clear_color_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "tag",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-color",
        ]
    )

    assert args.resource == "tag"
    assert args.tag_command == "update"
    assert args.clear_color is True


def test_cli_parser_supports_tag_list_person_filter() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "tag",
            "list",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )

    assert args.resource == "tag"
    assert args.tag_command == "list"
    assert str(args.person_id) == "11111111-1111-1111-1111-111111111111"


def test_cli_parser_supports_task_batch_delete_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "batch",
            "delete",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "batch"
    assert args.task_batch_command == "delete"
    assert len(args.task_ids) == 2


def test_cli_parser_supports_task_update_clear_parent_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-parent",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "update"
    assert str(args.task_id) == "11111111-1111-1111-1111-111111111111"
    assert args.clear_parent is True


def test_cli_parser_supports_task_update_clear_people_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-people",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "update"
    assert args.clear_people is True


def test_cli_parser_supports_habit_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit",
            "add",
            "Daily Exercise",
            "--start-date",
            "2026-04-09",
            "--duration-days",
            "21",
        ]
    )

    assert args.resource == "habit"
    assert args.habit_command == "add"
    assert args.title == "Daily Exercise"
    assert args.duration_days == 21


def test_cli_parser_supports_habit_update_clear_task_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-task",
        ]
    )

    assert args.resource == "habit"
    assert args.habit_command == "update"
    assert str(args.habit_id) == "11111111-1111-1111-1111-111111111111"
    assert args.clear_task is True


def test_cli_parser_supports_habit_action_list_by_date_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit-action",
            "list",
            "--action-date",
            "2026-04-09",
        ]
    )

    assert args.resource == "habit-action"
    assert args.habit_action_command == "list"
    assert str(args.action_date) == "2026-04-09"


def test_cli_parser_supports_event_update_clear_people_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "event",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-people",
        ]
    )

    assert args.resource == "event"
    assert args.event_command == "update"
    assert args.clear_people is True


def test_cli_parser_supports_timelog_update_clear_notes_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "timelog",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-notes",
        ]
    )

    assert args.resource == "timelog"
    assert args.timelog_command == "update"
    assert args.clear_notes is True


@pytest.mark.parametrize(
    ("argv",),
    [
        (["note", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "note",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["area", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "area",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["tag", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "tag",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["people", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "people",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["vision", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "vision",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["task", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "task",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["habit", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "habit",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["habit-action", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (["event", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "event",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["timelog", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "timelog",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
    ],
)
def test_cli_parser_rejects_hard_delete_flags(argv: list[str]) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(argv)


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
