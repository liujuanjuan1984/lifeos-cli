from __future__ import annotations

import pytest

from lifeos_cli.db.backend_policy import (
    SUPPORTED_DATABASE_DRIVERS,
    backend_policy_for_drivername,
    supported_database_driver_examples,
)


def test_backend_policy_declares_supported_driver_examples() -> None:
    assert SUPPORTED_DATABASE_DRIVERS == frozenset(
        {"postgresql+psycopg", "sqlite+aiosqlite"}
    )
    assert supported_database_driver_examples() == (
        "`postgresql+psycopg://`, `sqlite+aiosqlite://`"
    )


def test_backend_policy_for_postgresql_declares_schema_and_truncate_capabilities() -> None:
    policy = backend_policy_for_drivername("postgresql+psycopg")
    does_not_exist_guidance = policy.runtime_error_guidance("database does not exist")

    assert policy.backend_name == "postgresql"
    assert policy.supports_schema is True
    assert policy.supports_local_file_storage is False
    assert policy.enable_foreign_keys_on_connect is False
    assert policy.replace_existing_strategy == "truncate_cascade"
    assert policy.missing_driver_message is not None
    assert "lifeos-cli[postgres]" in policy.missing_driver_message
    assert does_not_exist_guidance is not None
    assert "Create it first" in does_not_exist_guidance


def test_backend_policy_for_sqlite_declares_file_and_runtime_capabilities() -> None:
    policy = backend_policy_for_drivername("sqlite+aiosqlite")
    sqlite_guidance = policy.runtime_error_guidance("unable to open database file")

    assert policy.backend_name == "sqlite"
    assert policy.supports_schema is False
    assert policy.supports_local_file_storage is True
    assert policy.enable_foreign_keys_on_connect is True
    assert policy.replace_existing_strategy == "delete_sorted_tables"
    assert sqlite_guidance is not None
    assert "parent directory exists and is writable" in sqlite_guidance


def test_backend_policy_rejects_unsupported_drivernames() -> None:
    with pytest.raises(ValueError, match="Unsupported database drivername"):
        backend_policy_for_drivername("mysql+asyncmy")
