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
    init_result = _run_lifeos(
        integration_context,
        "init",
        "--non-interactive",
        "--database-url",
        integration_context.database_url,
        "--schema",
        integration_context.schema,
    )
    assert init_result.returncode == 0, init_result.stderr
    assert "Database connection succeeded." in init_result.stdout
    assert "Database migrations are up to date." in init_result.stdout
    assert integration_context.config_path.exists()
    assert integration_context.schema in integration_context.config_path.read_text(encoding="utf-8")

    ping_result = _run_lifeos(integration_context, "db", "ping")
    assert ping_result.returncode == 0, ping_result.stderr
    assert "Database connection succeeded." in ping_result.stdout

    upgrade_result = _run_lifeos(integration_context, "db", "upgrade")
    assert upgrade_result.returncode == 0, upgrade_result.stderr
    assert "Database migrations are up to date." in upgrade_result.stdout


def test_real_cli_note_workflow(integration_context: IntegrationContext) -> None:
    init_result = _run_lifeos(
        integration_context,
        "init",
        "--non-interactive",
        "--database-url",
        integration_context.database_url,
        "--schema",
        integration_context.schema,
    )
    assert init_result.returncode == 0, init_result.stderr

    add_result = _run_lifeos(integration_context, "note", "add", "integration note")
    assert add_result.returncode == 0, add_result.stderr
    note_id = _extract_created_id(add_result.stdout)

    list_result = _run_lifeos(integration_context, "note", "list")
    assert list_result.returncode == 0, list_result.stderr
    assert note_id in list_result.stdout
    assert "integration note" in list_result.stdout

    show_result = _run_lifeos(integration_context, "note", "show", note_id)
    assert show_result.returncode == 0, show_result.stderr
    assert f"id: {note_id}" in show_result.stdout
    assert "content:\nintegration note" in show_result.stdout

    search_result = _run_lifeos(integration_context, "note", "search", "integration")
    assert search_result.returncode == 0, search_result.stderr
    assert note_id in search_result.stdout

    delete_result = _run_lifeos(integration_context, "note", "delete", note_id)
    assert delete_result.returncode == 0, delete_result.stderr
    assert f"Soft-deleted note {note_id}" in delete_result.stdout

    default_list_result = _run_lifeos(integration_context, "note", "list")
    assert default_list_result.returncode == 0, default_list_result.stderr
    assert note_id not in default_list_result.stdout

    deleted_list_result = _run_lifeos(integration_context, "note", "list", "--include-deleted")
    assert deleted_list_result.returncode == 0, deleted_list_result.stderr
    assert note_id in deleted_list_result.stdout
    assert "deleted" in deleted_list_result.stdout


def test_real_cli_structured_resource_workflow(integration_context: IntegrationContext) -> None:
    init_result = _run_lifeos(
        integration_context,
        "init",
        "--non-interactive",
        "--database-url",
        integration_context.database_url,
        "--schema",
        integration_context.schema,
    )
    assert init_result.returncode == 0, init_result.stderr

    area_result = _run_lifeos(integration_context, "area", "add", "Health")
    assert area_result.returncode == 0, area_result.stderr
    area_id = _extract_created_id(area_result.stdout)

    vision_result = _run_lifeos(
        integration_context,
        "vision",
        "add",
        "Launch lifeos-cli",
        "--area-id",
        area_id,
        "--status",
        "active",
    )
    assert vision_result.returncode == 0, vision_result.stderr
    vision_id = _extract_created_id(vision_result.stdout)

    task_result = _run_lifeos(
        integration_context,
        "task",
        "add",
        "Draft release checklist",
        "--vision-id",
        vision_id,
        "--status",
        "todo",
    )
    assert task_result.returncode == 0, task_result.stderr
    task_id = _extract_created_id(task_result.stdout)

    people_result = _run_lifeos(
        integration_context,
        "people",
        "add",
        "Alice",
        "--location",
        "Toronto",
    )
    assert people_result.returncode == 0, people_result.stderr
    person_id = _extract_created_id(people_result.stdout)

    tag_result = _run_lifeos(
        integration_context,
        "tag",
        "add",
        "family",
        "--entity-type",
        "person",
        "--category",
        "relation",
    )
    assert tag_result.returncode == 0, tag_result.stderr
    tag_id = _extract_created_id(tag_result.stdout)

    assert area_id in _run_lifeos(integration_context, "area", "list").stdout
    assert (
        vision_id in _run_lifeos(integration_context, "vision", "list", "--status", "active").stdout
    )
    assert (
        task_id in _run_lifeos(integration_context, "task", "list", "--vision-id", vision_id).stdout
    )
    assert person_id in _run_lifeos(integration_context, "people", "list").stdout
    assert (
        tag_id in _run_lifeos(integration_context, "tag", "list", "--entity-type", "person").stdout
    )

    task_show_result = _run_lifeos(integration_context, "task", "show", task_id)
    assert task_show_result.returncode == 0, task_show_result.stderr
    assert f"id: {task_id}" in task_show_result.stdout
    assert f"vision_id: {vision_id}" in task_show_result.stdout

    delete_result = _run_lifeos(integration_context, "task", "batch", "delete", "--ids", task_id)
    assert delete_result.returncode == 0, delete_result.stderr
    assert "Deleted tasks: 1" in delete_result.stdout

    deleted_result = _run_lifeos(
        integration_context,
        "task",
        "list",
        "--vision-id",
        vision_id,
        "--include-deleted",
    )
    assert deleted_result.returncode == 0, deleted_result.stderr
    assert task_id in deleted_result.stdout
    assert "deleted" in deleted_result.stdout
