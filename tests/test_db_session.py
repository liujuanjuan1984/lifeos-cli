from __future__ import annotations

import asyncio
import gc
import warnings
from pathlib import Path

import pytest
from sqlalchemy import text

from lifeos_cli.config import clear_config_cache
from lifeos_cli.db import session as db_session


def test_clear_session_cache_disposes_cached_sqlite_engine(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config_path = tmp_path / "lifeos-config.toml"
    database_path = tmp_path / "sqlite" / "lifeos.db"
    database_url = f"sqlite+aiosqlite:///{database_path}"

    clear_config_cache()
    db_session.clear_session_cache()
    monkeypatch.setenv("LIFEOS_CONFIG_FILE", str(config_path))
    monkeypatch.setenv("LIFEOS_DATABASE_URL", database_url)

    async def open_sqlite_connection() -> None:
        engine = db_session.get_async_engine()
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    asyncio.run(open_sqlite_connection())

    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always", ResourceWarning)
        db_session.clear_session_cache()
        gc.collect()

    resource_warnings = [warning for warning in captured if warning.category is ResourceWarning]
    assert resource_warnings == []

    clear_config_cache()
