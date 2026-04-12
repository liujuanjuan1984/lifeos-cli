from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

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

INTEGRATION_PYTESTMARK = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_INTEGRATION or TEST_DATABASE_URL is None,
        reason=(
            "set LIFEOS_RUN_INTEGRATION=1 and provide LIFEOS_TEST_DATABASE_URL "
            "(or a configured lifeos database URL) to run real CLI integration tests"
        ),
    ),
]


@dataclass(frozen=True)
class IntegrationContext:
    database_url: str
    schema: str
    config_path: Path
    env: dict[str, str]


def run_lifeos(
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


def assert_ok(result: subprocess.CompletedProcess[str]) -> None:
    assert result.returncode == 0, result.stderr


def assert_missing(result: subprocess.CompletedProcess[str], record_label: str) -> None:
    assert result.returncode == 1
    assert record_label in result.stderr


def extract_created_id(output: str) -> str:
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


def init_context(context: IntegrationContext, *extra_args: str) -> None:
    init_result = run_lifeos(
        context,
        "init",
        "--non-interactive",
        "--database-url",
        context.database_url,
        "--schema",
        context.schema,
        *extra_args,
    )
    assert_ok(init_result)
    assert "Database connection succeeded." in init_result.stdout
    assert "Database migrations are up to date." in init_result.stdout
