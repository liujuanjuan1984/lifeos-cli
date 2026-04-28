from __future__ import annotations

from pathlib import Path

from tests.cli_integration_support import normalize_integration_database_url

_RAW_TESTLESS_URL = "postgresql+psycopg://u:p@db/lifeos"  # pragma: allowlist secret
_NORMALIZED_TEST_URL = "postgresql+psycopg://u:p@db/lifeos_test"  # pragma: allowlist secret


def test_integration_support_uses_only_explicit_test_database_url() -> None:
    support_text = Path("tests/cli_integration_support.py").read_text(encoding="utf-8")
    env_assignment = '_RAW_INTEGRATION_DATABASE_URL = os.environ.get("LIFEOS_TEST_DATABASE_URL")'

    assert env_assignment in support_text
    assert "normalize_integration_database_url" in support_text
    assert "get_integration_database_url_from_env" not in support_text
    assert "DatabaseSettings.from_env" not in support_text
    assert "runtime config" not in support_text


def test_normalize_integration_database_url_appends_test_suffix_when_missing() -> None:
    assert normalize_integration_database_url(_RAW_TESTLESS_URL) == _NORMALIZED_TEST_URL


def test_normalize_integration_database_url_keeps_existing_test_marker() -> None:
    assert normalize_integration_database_url(_NORMALIZED_TEST_URL) == _NORMALIZED_TEST_URL
