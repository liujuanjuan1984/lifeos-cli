from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest

from tests.cli_integration_support import (
    TEST_DATABASE_URL,
    IntegrationContext,
    _drop_schema,
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
