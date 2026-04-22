from __future__ import annotations

import pytest

from lifeos_cli.i18n import keyed_message


def test_keyed_message_reads_default_json_catalog(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "en")

    assert (
        keyed_message("cli_help", "notes.datetime.configuredTimezone")
        == "When a datetime omits timezone information, the configured timezone is used before "
        "the value is converted to UTC."
    )


def test_keyed_message_reads_locale_json_catalog(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")

    assert (
        keyed_message("cli_help", "notes.datetime.configuredTimezone")
        == "当 datetime 省略 timezone 信息时，会先使用 configured timezone 解释该值，再转换为 UTC。"
    )


def test_keyed_message_falls_back_to_default_locale(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "fr-CA")

    assert keyed_message("cli_help", "notes.clearFlags.explicitOptionalValues") == (
        "Use `--clear-*` flags to explicitly remove optional values."
    )


def test_keyed_message_rejects_missing_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "en")

    with pytest.raises(KeyError):
        keyed_message("cli_help", "notes.missing")
