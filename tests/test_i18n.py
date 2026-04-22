from __future__ import annotations

import json
from pathlib import Path

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


def test_zh_hans_argparse_catalog_localizes_built_in_scaffolding() -> None:
    locales_dir = Path("src/lifeos_cli/locales")
    english_messages = json.loads((locales_dir / "en" / "argparse.json").read_text())["messages"]
    zh_hans_messages = json.loads((locales_dir / "zh_Hans" / "argparse.json").read_text())[
        "messages"
    ]

    assert zh_hans_messages.keys() == english_messages.keys()
    assert zh_hans_messages != english_messages
    assert zh_hans_messages["usage"] == "用法："
    assert zh_hans_messages["options"] == "选项"
    assert zh_hans_messages["show_this_help_message_and_exit"] == "显示此帮助信息并退出"
