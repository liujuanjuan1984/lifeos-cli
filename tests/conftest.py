from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest

from tests.cli_integration_support import (
    INTEGRATION_DATABASE_URL,
    IntegrationContext,
    _drop_schema,
)


@pytest.fixture(autouse=True)
def isolated_runtime_locale(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(tmp_path / "isolated-lifeos-config.toml"))
    monkeypatch.delenv("LIFEOS_LANGUAGE", raising=False)
    monkeypatch.delenv("LC_ALL", raising=False)
    monkeypatch.setenv("LANG", "C.UTF-8")


@pytest.fixture
def integration_context(tmp_path: Path) -> Iterator[IntegrationContext]:
    assert INTEGRATION_DATABASE_URL is not None
    schema = f"lifeos_test_{uuid4().hex[:12]}"
    config_path = tmp_path / "lifeos-config.toml"
    env = os.environ.copy()
    env["LIFEOS_CONFIG_FILE"] = str(config_path)
    env.pop("LIFEOS_DATABASE_URL", None)
    env.pop("LIFEOS_DATABASE_SCHEMA", None)
    env.pop("LIFEOS_DATABASE_ECHO", None)
    env.pop("LIFEOS_TIMEZONE", None)
    env.pop("LIFEOS_LANGUAGE", None)
    env.pop("LIFEOS_DAY_STARTS_AT", None)
    env.pop("LIFEOS_WEEK_STARTS_ON", None)
    env.pop("LIFEOS_VISION_EXPERIENCE_RATE_PER_HOUR", None)
    context = IntegrationContext(
        database_url=INTEGRATION_DATABASE_URL,
        schema=schema,
        config_path=config_path,
        env=env,
    )
    try:
        yield context
    finally:
        _drop_schema(INTEGRATION_DATABASE_URL, schema)
