from __future__ import annotations

from pathlib import Path

from tests.cli_integration_support import resolve_integration_database_url
from tests.config_support import write_test_config


def test_resolve_integration_database_url_prefers_explicit_test_database_url(
    tmp_path: Path,
) -> None:
    config_path = write_test_config(
        tmp_path / "config.toml",
        include_database=True,
        database_url="postgresql+psycopg://localhost:5432/lifeos_runtime",
        database_schema="lifeos_prod",
    )
    env = {
        "LIFEOS_CONFIG_FILE": str(config_path),
        "LIFEOS_TEST_DATABASE_URL": "postgresql+psycopg://localhost:5432/lifeos_test",
    }

    assert (
        resolve_integration_database_url(env)
        == "postgresql+psycopg://localhost:5432/lifeos_test"
    )


def test_resolve_integration_database_url_falls_back_to_runtime_database_url(
    tmp_path: Path,
) -> None:
    config_path = write_test_config(
        tmp_path / "config.toml",
        include_database=True,
        database_url="postgresql+psycopg://localhost:5432/lifeos_runtime",
        database_schema="lifeos_prod",
    )
    env = {"LIFEOS_CONFIG_FILE": str(config_path)}

    assert resolve_integration_database_url(env) == "postgresql+psycopg://localhost:5432/lifeos_runtime"


def test_resolve_integration_database_url_returns_none_for_invalid_runtime_config() -> None:
    env = {
        "LIFEOS_DATABASE_URL": "postgresql+psycopg://localhost:5432/lifeos_runtime",
        "LIFEOS_DATABASE_SCHEMA": "lifeos-prod",
    }

    assert resolve_integration_database_url(env) is None
