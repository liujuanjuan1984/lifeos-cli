from __future__ import annotations

import os
import re
import subprocess
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine import make_url

from lifeos_cli.config import ConfigurationError, DatabaseSettings

REPO_ROOT = Path(__file__).resolve().parents[1]
_ID_PATTERN = re.compile(
    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)


def _resolve_test_database_url() -> str | None:
    explicit = os.environ.get("LIFEOS_TEST_DATABASE_URL")
    if explicit:
        return explicit
    try:
        return DatabaseSettings.from_env().require_database_url()
    except ConfigurationError:
        return None


RUN_INTEGRATION = os.environ.get("LIFEOS_RUN_INTEGRATION") == "1"
TEST_DATABASE_URL = _resolve_test_database_url()

pytestmark = pytest.mark.skipif(
    not RUN_INTEGRATION or TEST_DATABASE_URL is None,
    reason=(
        "set LIFEOS_RUN_INTEGRATION=1 and provide LIFEOS_TEST_DATABASE_URL "
        "(or a configured lifeos database URL) to run real CLI integration tests"
    ),
)


@dataclass(frozen=True)
class IntegrationContext:
    database_url: str
    schema: str
    config_path: Path
    env: dict[str, str]


def _run_lifeos(
    context: IntegrationContext,
    *args: str,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["uv", "run", "lifeos", *args],
        cwd=REPO_ROOT,
        env=context.env,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
    )


def _assert_ok(result: subprocess.CompletedProcess[str]) -> None:
    assert result.returncode == 0, result.stderr


def _assert_missing(result: subprocess.CompletedProcess[str], record_label: str) -> None:
    assert result.returncode == 1
    assert record_label in result.stderr


def _extract_created_id(output: str) -> str:
    match = _ID_PATTERN.search(output)
    if match is None:
        raise AssertionError(f"could not find identifier in output: {output!r}")
    return match.group(1)


def _drop_schema(database_url: str, schema_name: str) -> None:
    parsed = make_url(database_url)
    with psycopg.connect(
        dbname=parsed.database,
        user=parsed.username,
        password=parsed.password,
        host=parsed.host,
        port=parsed.port,
        autocommit=True,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(sql.Identifier(schema_name))
            )


def _init_context(context: IntegrationContext) -> None:
    init_result = _run_lifeos(
        context,
        "init",
        "--non-interactive",
        "--database-url",
        context.database_url,
        "--schema",
        context.schema,
    )
    _assert_ok(init_result)
    assert "Database connection succeeded." in init_result.stdout
    assert "Database migrations are up to date." in init_result.stdout


@pytest.fixture
def integration_context(tmp_path: Path) -> Iterator[IntegrationContext]:
    assert TEST_DATABASE_URL is not None
    schema = f"lifeos_test_{uuid4().hex[:12]}"
    config_path = tmp_path / "lifeos-config.toml"
    env = os.environ.copy()
    env["LIFEOS_CONFIG_FILE"] = str(config_path)
    env.pop("LIFEOS_DATABASE_URL", None)
    env.pop("LIFEOS_DATABASE_SCHEMA", None)
    env.pop("LIFEOS_DATABASE_ECHO", None)
    context = IntegrationContext(
        database_url=TEST_DATABASE_URL,
        schema=schema,
        config_path=config_path,
        env=env,
    )
    try:
        yield context
    finally:
        _drop_schema(TEST_DATABASE_URL, schema)


def test_real_cli_init_and_db_commands(integration_context: IntegrationContext) -> None:
    _init_context(integration_context)

    assert integration_context.config_path.exists()
    assert integration_context.schema in integration_context.config_path.read_text(encoding="utf-8")

    ping_result = _run_lifeos(integration_context, "db", "ping")
    _assert_ok(ping_result)
    assert "Database connection succeeded." in ping_result.stdout

    upgrade_result = _run_lifeos(integration_context, "db", "upgrade")
    _assert_ok(upgrade_result)
    assert "Database migrations are up to date." in upgrade_result.stdout

    config_result = _run_lifeos(integration_context, "config", "show")
    _assert_ok(config_result)
    assert integration_context.schema in config_result.stdout


def test_real_cli_note_workflow(integration_context: IntegrationContext) -> None:
    _init_context(integration_context)

    first_add_result = _run_lifeos(integration_context, "note", "add", "integration note")
    _assert_ok(first_add_result)
    first_note_id = _extract_created_id(first_add_result.stdout)

    second_add_result = _run_lifeos(
        integration_context,
        "note",
        "add",
        "--stdin",
        input_text="first line\nsecond line\n",
    )
    _assert_ok(second_add_result)
    second_note_id = _extract_created_id(second_add_result.stdout)

    list_result = _run_lifeos(integration_context, "note", "list")
    _assert_ok(list_result)
    assert first_note_id in list_result.stdout
    assert second_note_id in list_result.stdout

    show_result = _run_lifeos(integration_context, "note", "show", second_note_id)
    _assert_ok(show_result)
    assert f"id: {second_note_id}" in show_result.stdout
    assert "content:\nfirst line\nsecond line" in show_result.stdout

    update_result = _run_lifeos(
        integration_context,
        "note",
        "update",
        first_note_id,
        "integration note updated",
    )
    _assert_ok(update_result)
    assert f"Updated note {first_note_id}" in update_result.stdout

    search_result = _run_lifeos(integration_context, "note", "search", "integration")
    _assert_ok(search_result)
    assert first_note_id in search_result.stdout

    batch_update_result = _run_lifeos(
        integration_context,
        "note",
        "batch",
        "update-content",
        "--ids",
        first_note_id,
        second_note_id,
        "--find-text",
        "line",
        "--replace-text",
        "entry",
    )
    _assert_ok(batch_update_result)
    assert "Updated notes: 1" in batch_update_result.stdout

    updated_multiline_result = _run_lifeos(integration_context, "note", "show", second_note_id)
    _assert_ok(updated_multiline_result)
    assert "content:\nfirst entry\nsecond entry" in updated_multiline_result.stdout

    delete_result = _run_lifeos(integration_context, "note", "delete", first_note_id)
    _assert_ok(delete_result)
    assert f"Soft-deleted note {first_note_id}" in delete_result.stdout

    batch_delete_result = _run_lifeos(
        integration_context,
        "note",
        "batch",
        "delete",
        "--ids",
        second_note_id,
    )
    _assert_ok(batch_delete_result)
    assert "Deleted notes: 1" in batch_delete_result.stdout

    deleted_list_result = _run_lifeos(integration_context, "note", "list", "--include-deleted")
    _assert_ok(deleted_list_result)
    assert first_note_id in deleted_list_result.stdout
    assert second_note_id in deleted_list_result.stdout
    assert "deleted" in deleted_list_result.stdout

    missing_show_result = _run_lifeos(
        integration_context,
        "note",
        "show",
        "00000000-0000-0000-0000-000000000000",
    )
    _assert_missing(missing_show_result, "00000000-0000-0000-0000-000000000000")


def test_real_cli_core_resource_workflow(integration_context: IntegrationContext) -> None:
    _init_context(integration_context)

    area_one_result = _run_lifeos(integration_context, "area", "add", "Health")
    _assert_ok(area_one_result)
    area_one_id = _extract_created_id(area_one_result.stdout)

    area_two_result = _run_lifeos(
        integration_context,
        "area",
        "add",
        "Work",
        "--inactive",
    )
    _assert_ok(area_two_result)
    area_two_id = _extract_created_id(area_two_result.stdout)

    area_show_result = _run_lifeos(integration_context, "area", "show", area_one_id)
    _assert_ok(area_show_result)
    assert f"id: {area_one_id}" in area_show_result.stdout

    area_update_result = _run_lifeos(
        integration_context,
        "area",
        "update",
        area_one_id,
        "--description",
        "Physical wellbeing",
        "--icon",
        "heart",
    )
    _assert_ok(area_update_result)
    assert f"Updated area {area_one_id}" in area_update_result.stdout

    area_clear_result = _run_lifeos(
        integration_context,
        "area",
        "update",
        area_one_id,
        "--clear-description",
        "--clear-icon",
    )
    _assert_ok(area_clear_result)

    vision_one_result = _run_lifeos(
        integration_context,
        "vision",
        "add",
        "Launch lifeos-cli",
        "--area-id",
        area_one_id,
        "--status",
        "active",
    )
    _assert_ok(vision_one_result)
    vision_one_id = _extract_created_id(vision_one_result.stdout)

    vision_two_result = _run_lifeos(
        integration_context,
        "vision",
        "add",
        "Improve sleep quality",
        "--area-id",
        area_two_id,
    )
    _assert_ok(vision_two_result)
    vision_two_id = _extract_created_id(vision_two_result.stdout)

    vision_show_result = _run_lifeos(integration_context, "vision", "show", vision_one_id)
    _assert_ok(vision_show_result)
    assert f"area_id: {area_one_id}" in vision_show_result.stdout

    vision_update_result = _run_lifeos(
        integration_context,
        "vision",
        "update",
        vision_one_id,
        "--description",
        "Deliver the first production-ready release",
        "--status",
        "fruit",
    )
    _assert_ok(vision_update_result)

    vision_clear_result = _run_lifeos(
        integration_context,
        "vision",
        "update",
        vision_one_id,
        "--clear-description",
        "--clear-area",
    )
    _assert_ok(vision_clear_result)

    task_one_result = _run_lifeos(
        integration_context,
        "task",
        "add",
        "Draft release checklist",
        "--vision-id",
        vision_one_id,
        "--status",
        "todo",
    )
    _assert_ok(task_one_result)
    task_one_id = _extract_created_id(task_one_result.stdout)

    task_two_result = _run_lifeos(
        integration_context,
        "task",
        "add",
        "Write changelog",
        "--vision-id",
        vision_one_id,
        "--parent-task-id",
        task_one_id,
        "--estimated-effort",
        "45",
    )
    _assert_ok(task_two_result)
    task_two_id = _extract_created_id(task_two_result.stdout)

    task_show_result = _run_lifeos(integration_context, "task", "show", task_two_id)
    _assert_ok(task_show_result)
    assert f"parent_task_id: {task_one_id}" in task_show_result.stdout

    task_update_result = _run_lifeos(
        integration_context,
        "task",
        "update",
        task_two_id,
        "--status",
        "in_progress",
        "--clear-parent",
        "--clear-estimated-effort",
    )
    _assert_ok(task_update_result)

    person_one_result = _run_lifeos(
        integration_context,
        "people",
        "add",
        "Alice",
        "--location",
        "Toronto",
    )
    _assert_ok(person_one_result)
    person_one_id = _extract_created_id(person_one_result.stdout)

    person_two_result = _run_lifeos(
        integration_context,
        "people",
        "add",
        "Bob",
        "--location",
        "Montreal",
    )
    _assert_ok(person_two_result)
    person_two_id = _extract_created_id(person_two_result.stdout)

    person_show_result = _run_lifeos(integration_context, "people", "show", person_one_id)
    _assert_ok(person_show_result)
    assert "location: Toronto" in person_show_result.stdout

    people_update_result = _run_lifeos(
        integration_context,
        "people",
        "update",
        person_one_id,
        "--nickname",
        "ally",
        "--clear-location",
    )
    _assert_ok(people_update_result)

    area_people_result = _run_lifeos(
        integration_context,
        "area",
        "update",
        area_one_id,
        "--person-id",
        person_one_id,
        "--person-id",
        person_two_id,
    )
    _assert_ok(area_people_result)

    tag_one_result = _run_lifeos(
        integration_context,
        "tag",
        "add",
        "family",
        "--entity-type",
        "person",
        "--category",
        "relation",
    )
    _assert_ok(tag_one_result)
    tag_one_id = _extract_created_id(tag_one_result.stdout)

    tag_two_result = _run_lifeos(
        integration_context,
        "tag",
        "add",
        "friend",
        "--entity-type",
        "person",
        "--category",
        "relation",
    )
    _assert_ok(tag_two_result)
    tag_two_id = _extract_created_id(tag_two_result.stdout)

    tag_show_result = _run_lifeos(integration_context, "tag", "show", tag_one_id)
    _assert_ok(tag_show_result)
    assert "entity_type: person" in tag_show_result.stdout

    tag_update_result = _run_lifeos(
        integration_context,
        "tag",
        "update",
        tag_one_id,
        "--description",
        "Relationship marker",
        "--color",
        "#22C55E",
    )
    _assert_ok(tag_update_result)

    tag_people_result = _run_lifeos(
        integration_context,
        "tag",
        "update",
        tag_one_id,
        "--person-id",
        person_one_id,
    )
    _assert_ok(tag_people_result)

    tag_clear_result = _run_lifeos(
        integration_context,
        "tag",
        "update",
        tag_one_id,
        "--clear-description",
        "--clear-color",
    )
    _assert_ok(tag_clear_result)

    vision_people_result = _run_lifeos(
        integration_context,
        "vision",
        "update",
        vision_one_id,
        "--person-id",
        person_one_id,
        "--person-id",
        person_two_id,
    )
    _assert_ok(vision_people_result)

    task_people_result = _run_lifeos(
        integration_context,
        "task",
        "update",
        task_one_id,
        "--person-id",
        person_one_id,
    )
    _assert_ok(task_people_result)

    assert area_one_id in _run_lifeos(integration_context, "area", "list").stdout
    assert (
        area_one_id
        in _run_lifeos(
            integration_context,
            "area",
            "list",
            "--person-id",
            person_one_id,
        ).stdout
    )
    assert vision_one_id in _run_lifeos(integration_context, "vision", "list").stdout
    assert (
        vision_one_id
        in _run_lifeos(
            integration_context,
            "vision",
            "list",
            "--person-id",
            person_two_id,
        ).stdout
    )
    assert (
        task_one_id
        in _run_lifeos(
            integration_context,
            "task",
            "list",
            "--vision-id",
            vision_one_id,
        ).stdout
    )
    assert (
        task_one_id
        in _run_lifeos(
            integration_context,
            "task",
            "list",
            "--person-id",
            person_one_id,
        ).stdout
    )
    assert (
        person_one_id
        in _run_lifeos(
            integration_context,
            "people",
            "list",
            "--search",
            "Ali",
        ).stdout
    )
    assert (
        tag_one_id
        in _run_lifeos(
            integration_context,
            "tag",
            "list",
            "--entity-type",
            "person",
        ).stdout
    )
    assert (
        tag_one_id
        in _run_lifeos(
            integration_context,
            "tag",
            "list",
            "--person-id",
            person_one_id,
        ).stdout
    )

    area_show_with_people_result = _run_lifeos(integration_context, "area", "show", area_one_id)
    _assert_ok(area_show_with_people_result)
    assert "people: Alice, Bob" in area_show_with_people_result.stdout

    vision_show_with_people_result = _run_lifeos(
        integration_context,
        "vision",
        "show",
        vision_one_id,
    )
    _assert_ok(vision_show_with_people_result)
    assert "people: Alice, Bob" in vision_show_with_people_result.stdout

    task_show_with_people_result = _run_lifeos(integration_context, "task", "show", task_one_id)
    _assert_ok(task_show_with_people_result)
    assert "people: Alice" in task_show_with_people_result.stdout

    tag_show_with_people_result = _run_lifeos(integration_context, "tag", "show", tag_one_id)
    _assert_ok(tag_show_with_people_result)
    assert "people: Alice" in tag_show_with_people_result.stdout

    people_delete_result = _run_lifeos(
        integration_context,
        "people",
        "delete",
        person_one_id,
    )
    _assert_ok(people_delete_result)
    assert f"Soft-deleted person {person_one_id}" in people_delete_result.stdout

    people_batch_delete_result = _run_lifeos(
        integration_context,
        "people",
        "batch",
        "delete",
        "--ids",
        person_two_id,
    )
    _assert_ok(people_batch_delete_result)
    assert "Deleted people: 1" in people_batch_delete_result.stdout

    tag_delete_result = _run_lifeos(integration_context, "tag", "delete", tag_one_id)
    _assert_ok(tag_delete_result)
    assert f"Soft-deleted tag {tag_one_id}" in tag_delete_result.stdout

    tag_batch_delete_result = _run_lifeos(
        integration_context,
        "tag",
        "batch",
        "delete",
        "--ids",
        tag_two_id,
    )
    _assert_ok(tag_batch_delete_result)
    assert "Deleted tags: 1" in tag_batch_delete_result.stdout

    task_delete_result = _run_lifeos(integration_context, "task", "delete", task_two_id)
    _assert_ok(task_delete_result)
    assert f"Soft-deleted task {task_two_id}" in task_delete_result.stdout

    task_batch_delete_result = _run_lifeos(
        integration_context,
        "task",
        "batch",
        "delete",
        "--ids",
        task_one_id,
    )
    _assert_ok(task_batch_delete_result)
    assert "Deleted tasks: 1" in task_batch_delete_result.stdout

    vision_delete_result = _run_lifeos(integration_context, "vision", "delete", vision_one_id)
    _assert_ok(vision_delete_result)
    assert f"Soft-deleted vision {vision_one_id}" in vision_delete_result.stdout

    vision_batch_delete_result = _run_lifeos(
        integration_context,
        "vision",
        "batch",
        "delete",
        "--ids",
        vision_two_id,
    )
    _assert_ok(vision_batch_delete_result)
    assert "Deleted visions: 1" in vision_batch_delete_result.stdout

    area_delete_result = _run_lifeos(integration_context, "area", "delete", area_one_id)
    _assert_ok(area_delete_result)
    assert f"Soft-deleted area {area_one_id}" in area_delete_result.stdout

    area_batch_delete_result = _run_lifeos(
        integration_context,
        "area",
        "batch",
        "delete",
        "--ids",
        area_two_id,
    )
    _assert_ok(area_batch_delete_result)
    assert "Deleted areas: 1" in area_batch_delete_result.stdout

    deleted_area_result = _run_lifeos(
        integration_context,
        "area",
        "list",
        "--include-deleted",
        "--include-inactive",
    )
    _assert_ok(deleted_area_result)
    assert area_one_id in deleted_area_result.stdout
    assert area_two_id in deleted_area_result.stdout
    assert "deleted" in deleted_area_result.stdout


def test_real_cli_habit_workflow(integration_context: IntegrationContext) -> None:
    _init_context(integration_context)

    vision_result = _run_lifeos(integration_context, "vision", "add", "Improve fitness")
    _assert_ok(vision_result)
    vision_id = _extract_created_id(vision_result.stdout)

    task_result = _run_lifeos(
        integration_context,
        "task",
        "add",
        "Exercise consistently",
        "--vision-id",
        vision_id,
    )
    _assert_ok(task_result)
    task_id = _extract_created_id(task_result.stdout)

    first_habit_result = _run_lifeos(
        integration_context,
        "habit",
        "add",
        "Daily Exercise",
        "--start-date",
        "2026-04-09",
        "--duration-days",
        "21",
        "--task-id",
        task_id,
    )
    _assert_ok(first_habit_result)
    first_habit_id = _extract_created_id(first_habit_result.stdout)

    second_habit_result = _run_lifeos(
        integration_context,
        "habit",
        "add",
        "Morning Review",
        "--start-date",
        "2026-04-09",
        "--duration-days",
        "100",
    )
    _assert_ok(second_habit_result)
    second_habit_id = _extract_created_id(second_habit_result.stdout)

    habit_list_result = _run_lifeos(integration_context, "habit", "list", "--with-stats")
    _assert_ok(habit_list_result)
    assert first_habit_id in habit_list_result.stdout
    assert second_habit_id in habit_list_result.stdout

    habit_show_result = _run_lifeos(integration_context, "habit", "show", first_habit_id)
    _assert_ok(habit_show_result)
    assert f"id: {first_habit_id}" in habit_show_result.stdout
    assert "total_actions: 21" in habit_show_result.stdout

    task_association_result = _run_lifeos(
        integration_context,
        "habit",
        "task-associations",
    )
    _assert_ok(task_association_result)
    assert first_habit_id in task_association_result.stdout
    assert task_id in task_association_result.stdout

    habit_update_result = _run_lifeos(
        integration_context,
        "habit",
        "update",
        first_habit_id,
        "--description",
        "Move every day",
        "--status",
        "paused",
    )
    _assert_ok(habit_update_result)
    assert f"Updated habit {first_habit_id}" in habit_update_result.stdout

    habit_clear_result = _run_lifeos(
        integration_context,
        "habit",
        "update",
        first_habit_id,
        "--clear-description",
        "--clear-task",
        "--status",
        "active",
    )
    _assert_ok(habit_clear_result)

    habit_stats_result = _run_lifeos(integration_context, "habit", "stats", first_habit_id)
    _assert_ok(habit_stats_result)
    assert f"habit_id: {first_habit_id}" in habit_stats_result.stdout

    action_list_result = _run_lifeos(
        integration_context,
        "habit-action",
        "list",
        "--habit-id",
        first_habit_id,
    )
    _assert_ok(action_list_result)
    action_id = _extract_created_id(action_list_result.stdout)

    action_show_result = _run_lifeos(integration_context, "habit-action", "show", action_id)
    _assert_ok(action_show_result)
    assert f"id: {action_id}" in action_show_result.stdout

    action_update_result = _run_lifeos(
        integration_context,
        "habit-action",
        "update",
        action_id,
        "--status",
        "done",
        "--notes",
        "Completed before work",
    )
    _assert_ok(action_update_result)
    assert f"Updated habit action {action_id}" in action_update_result.stdout

    action_clear_result = _run_lifeos(
        integration_context,
        "habit-action",
        "update",
        action_id,
        "--status",
        "skip",
        "--clear-notes",
    )
    _assert_ok(action_clear_result)

    action_date_result = _run_lifeos(
        integration_context,
        "habit-action",
        "list",
        "--action-date",
        "2026-04-09",
    )
    _assert_ok(action_date_result)
    assert action_id in action_date_result.stdout

    habit_delete_result = _run_lifeos(integration_context, "habit", "delete", first_habit_id)
    _assert_ok(habit_delete_result)
    assert f"Soft-deleted habit {first_habit_id}" in habit_delete_result.stdout

    habit_batch_delete_result = _run_lifeos(
        integration_context,
        "habit",
        "batch",
        "delete",
        "--ids",
        second_habit_id,
    )
    _assert_ok(habit_batch_delete_result)
    assert "Deleted habits: 1" in habit_batch_delete_result.stdout

    deleted_habit_result = _run_lifeos(integration_context, "habit", "list", "--include-deleted")
    _assert_ok(deleted_habit_result)
    assert first_habit_id in deleted_habit_result.stdout
    assert second_habit_id in deleted_habit_result.stdout
    assert "deleted" in deleted_habit_result.stdout


def test_real_cli_event_and_timelog_workflow(integration_context: IntegrationContext) -> None:
    _init_context(integration_context)

    area_result = _run_lifeos(integration_context, "area", "add", "Health")
    _assert_ok(area_result)
    area_id = _extract_created_id(area_result.stdout)

    vision_result = _run_lifeos(integration_context, "vision", "add", "Improve fitness")
    _assert_ok(vision_result)
    vision_id = _extract_created_id(vision_result.stdout)

    task_result = _run_lifeos(
        integration_context,
        "task",
        "add",
        "Morning run",
        "--vision-id",
        vision_id,
    )
    _assert_ok(task_result)
    task_id = _extract_created_id(task_result.stdout)

    person_result = _run_lifeos(integration_context, "people", "add", "Coach")
    _assert_ok(person_result)
    person_id = _extract_created_id(person_result.stdout)

    event_tag_result = _run_lifeos(
        integration_context,
        "tag",
        "add",
        "calendar",
        "--entity-type",
        "event",
        "--category",
        "context",
    )
    _assert_ok(event_tag_result)
    event_tag_id = _extract_created_id(event_tag_result.stdout)

    timelog_tag_result = _run_lifeos(
        integration_context,
        "tag",
        "add",
        "tracked",
        "--entity-type",
        "timelog",
        "--category",
        "context",
    )
    _assert_ok(timelog_tag_result)
    timelog_tag_id = _extract_created_id(timelog_tag_result.stdout)

    first_event_result = _run_lifeos(
        integration_context,
        "event",
        "add",
        "Morning run block",
        "--start-time",
        "2026-04-10T07:00:00-04:00",
        "--end-time",
        "2026-04-10T07:45:00-04:00",
        "--area-id",
        area_id,
        "--task-id",
        task_id,
        "--person-id",
        person_id,
        "--tag-id",
        event_tag_id,
    )
    _assert_ok(first_event_result)
    first_event_id = _extract_created_id(first_event_result.stdout)

    second_event_result = _run_lifeos(
        integration_context,
        "event",
        "add",
        "Recovery block",
        "--start-time",
        "2026-04-10T18:00:00-04:00",
        "--end-time",
        "2026-04-10T19:00:00-04:00",
    )
    _assert_ok(second_event_result)
    second_event_id = _extract_created_id(second_event_result.stdout)

    event_list_result = _run_lifeos(
        integration_context,
        "event",
        "list",
        "--task-id",
        task_id,
    )
    _assert_ok(event_list_result)
    assert first_event_id in event_list_result.stdout

    event_show_result = _run_lifeos(integration_context, "event", "show", first_event_id)
    _assert_ok(event_show_result)
    assert "people: Coach" in event_show_result.stdout
    assert "tags: calendar" in event_show_result.stdout

    event_update_result = _run_lifeos(
        integration_context,
        "event",
        "update",
        first_event_id,
        "--status",
        "completed",
        "--clear-task",
        "--clear-area",
        "--clear-tags",
        "--clear-people",
        "--clear-end-time",
    )
    _assert_ok(event_update_result)

    updated_event_result = _run_lifeos(integration_context, "event", "show", first_event_id)
    _assert_ok(updated_event_result)
    assert "task_id: -" in updated_event_result.stdout
    assert "area_id: -" in updated_event_result.stdout
    assert "tags: -" in updated_event_result.stdout
    assert "people: -" in updated_event_result.stdout

    first_timelog_result = _run_lifeos(
        integration_context,
        "timelog",
        "add",
        "Morning run",
        "--start-time",
        "2026-04-10T07:02:00-04:00",
        "--end-time",
        "2026-04-10T07:41:00-04:00",
        "--area-id",
        area_id,
        "--task-id",
        task_id,
        "--person-id",
        person_id,
        "--tag-id",
        timelog_tag_id,
        "--energy-level",
        "4",
    )
    _assert_ok(first_timelog_result)
    first_timelog_id = _extract_created_id(first_timelog_result.stdout)

    second_timelog_result = _run_lifeos(
        integration_context,
        "timelog",
        "add",
        "Stretching",
        "--start-time",
        "2026-04-10T19:10:00-04:00",
        "--end-time",
        "2026-04-10T19:25:00-04:00",
    )
    _assert_ok(second_timelog_result)
    second_timelog_id = _extract_created_id(second_timelog_result.stdout)

    timelog_list_result = _run_lifeos(
        integration_context,
        "timelog",
        "list",
        "--window-start",
        "2026-04-10T00:00:00-04:00",
        "--window-end",
        "2026-04-10T23:59:59-04:00",
    )
    _assert_ok(timelog_list_result)
    assert first_timelog_id in timelog_list_result.stdout
    assert second_timelog_id in timelog_list_result.stdout

    timelog_show_result = _run_lifeos(integration_context, "timelog", "show", first_timelog_id)
    _assert_ok(timelog_show_result)
    assert "people: Coach" in timelog_show_result.stdout
    assert "tags: tracked" in timelog_show_result.stdout

    timelog_update_result = _run_lifeos(
        integration_context,
        "timelog",
        "update",
        first_timelog_id,
        "--notes",
        "Felt strong",
        "--clear-task",
        "--clear-area",
        "--clear-tags",
        "--clear-people",
        "--clear-energy-level",
    )
    _assert_ok(timelog_update_result)

    updated_timelog_result = _run_lifeos(
        integration_context,
        "timelog",
        "show",
        first_timelog_id,
    )
    _assert_ok(updated_timelog_result)
    assert "task_id: -" in updated_timelog_result.stdout
    assert "area_id: -" in updated_timelog_result.stdout
    assert "tags: -" in updated_timelog_result.stdout
    assert "people: -" in updated_timelog_result.stdout

    event_delete_result = _run_lifeos(
        integration_context,
        "event",
        "delete",
        first_event_id,
    )
    _assert_ok(event_delete_result)
    assert f"Soft-deleted event {first_event_id}" in event_delete_result.stdout

    event_batch_delete_result = _run_lifeos(
        integration_context,
        "event",
        "batch",
        "delete",
        "--ids",
        second_event_id,
    )
    _assert_ok(event_batch_delete_result)
    assert "Deleted events: 1" in event_batch_delete_result.stdout

    timelog_delete_result = _run_lifeos(
        integration_context,
        "timelog",
        "delete",
        first_timelog_id,
    )
    _assert_ok(timelog_delete_result)
    assert f"Soft-deleted timelog {first_timelog_id}" in timelog_delete_result.stdout

    timelog_batch_delete_result = _run_lifeos(
        integration_context,
        "timelog",
        "batch",
        "delete",
        "--ids",
        second_timelog_id,
    )
    _assert_ok(timelog_batch_delete_result)
    assert "Deleted timelogs: 1" in timelog_batch_delete_result.stdout

    deleted_event_result = _run_lifeos(
        integration_context,
        "event",
        "list",
        "--include-deleted",
    )
    _assert_ok(deleted_event_result)
    assert first_event_id in deleted_event_result.stdout
    assert second_event_id in deleted_event_result.stdout
    assert "deleted" in deleted_event_result.stdout

    deleted_timelog_result = _run_lifeos(
        integration_context,
        "timelog",
        "list",
        "--include-deleted",
        "--window-start",
        "2026-04-10T00:00:00-04:00",
        "--window-end",
        "2026-04-10T23:59:59-04:00",
    )
    _assert_ok(deleted_timelog_result)
    assert first_timelog_id in deleted_timelog_result.stdout
    assert second_timelog_id in deleted_timelog_result.stdout
    assert "deleted" in deleted_timelog_result.stdout
