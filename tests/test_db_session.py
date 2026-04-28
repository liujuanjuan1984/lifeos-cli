from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from lifeos_cli.db import session as db_session


def test_clear_session_cache_disposes_cached_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dispose = AsyncMock()
    fake_engine = SimpleNamespace(dispose=dispose)

    monkeypatch.setattr(db_session, "_CACHED_ENGINE", fake_engine)

    db_session.clear_session_cache()

    dispose.assert_awaited_once()
    assert db_session._CACHED_ENGINE is None
