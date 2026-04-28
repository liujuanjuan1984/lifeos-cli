from __future__ import annotations

from pathlib import Path


def test_integration_support_uses_only_explicit_test_database_url() -> None:
    support_text = Path("tests/cli_integration_support.py").read_text(encoding="utf-8")

    assert 'INTEGRATION_DATABASE_URL = os.environ.get("LIFEOS_TEST_DATABASE_URL")' in support_text
    assert "DatabaseSettings.from_env" not in support_text
    assert "runtime config" not in support_text
