"""JSON key-value i18n helpers for user-facing CLI text."""

from __future__ import annotations

import argparse
import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

from lifeos_cli.config import (
    ConfigurationError,
    detect_default_language,
    get_preferences_settings,
)

LOCALES_DIR = Path(__file__).with_name("locales")
DEFAULT_LOCALE = "en"


def _normalize_locale_tag(locale_tag: str) -> str:
    """Convert a BCP-47-like tag into the locale directory naming convention."""
    return locale_tag.strip().replace("-", "_")


def _locale_candidates(locale_tag: str) -> list[str]:
    """Return locale lookup candidates from most specific to least specific."""
    normalized = _normalize_locale_tag(locale_tag)
    parts = [part for part in normalized.split("_") if part]
    if not parts:
        return [DEFAULT_LOCALE]
    candidates = ["_".join(parts[: index + 1]) for index in range(len(parts))]
    candidates.reverse()
    if DEFAULT_LOCALE not in candidates:
        candidates.append(DEFAULT_LOCALE)
    return candidates


def resolve_locale() -> str:
    """Resolve the active locale for user-facing CLI text."""
    env_locale = os.environ.get("LIFEOS_LANGUAGE")
    if env_locale:
        return env_locale
    try:
        return get_preferences_settings().language
    except ConfigurationError:
        return detect_default_language()


def _validate_catalog_name(catalog_name: str) -> None:
    """Reject catalog names that could escape the locale directory."""
    if not catalog_name.replace("_", "").isalnum():
        raise ValueError(f"Invalid keyed message catalog name: {catalog_name}")


@lru_cache(maxsize=64)
def _load_keyed_catalog(locale_name: str, catalog_name: str) -> dict[str, Any]:
    """Load one JSON key-value message catalog."""
    _validate_catalog_name(catalog_name)
    catalog_path = LOCALES_DIR / locale_name / f"{catalog_name}.json"
    if not catalog_path.exists():
        return {}
    with catalog_path.open("r", encoding="utf-8") as catalog_file:
        catalog = json.load(catalog_file)
    if not isinstance(catalog, dict):
        raise ValueError(f"Keyed message catalog must contain a JSON object: {catalog_path}")
    return catalog


def _lookup_keyed_message(catalog: dict[str, Any], key: str) -> str | None:
    """Return one dotted-key catalog value when present."""
    node: Any = catalog
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    if not isinstance(node, str):
        raise KeyError(f"Keyed message must resolve to a string: {key}")
    return node


def keyed_message(catalog_name: str, key: str) -> str:
    """Translate one user-facing message from a JSON key-value catalog."""
    locale_tag = resolve_locale()
    for locale_name in _locale_candidates(locale_tag):
        catalog = _load_keyed_catalog(locale_name, catalog_name)
        value = _lookup_keyed_message(catalog, key)
        if value is not None:
            return value
    raise KeyError(f"Missing keyed message: {catalog_name}.{key}")


def cli_message(key: str) -> str:
    """Translate one keyed CLI message."""
    return keyed_message("cli_messages", key)


def _message_key_for_text(message: str) -> str:
    """Return the stable catalog key for an argparse built-in message."""
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", message.lower()).strip("_")
    normalized = re.sub(r"_+", "_", normalized)
    return f"messages.{normalized or 'message'}"


def _argparse_message(message: str | None) -> str | None:
    """Translate one argparse built-in message."""
    if message is None:
        return None
    try:
        return keyed_message("argparse", _message_key_for_text(message))
    except KeyError:
        return message


def _argparse_plural_message(singular: str, plural: str, count: int) -> str:
    """Translate one argparse plural message."""
    translated = _argparse_message(singular if count == 1 else plural)
    assert translated is not None
    return translated


def configure_argparse_translations() -> None:
    """Route argparse built-in help and error text through keyed JSON catalogs."""
    argparse_module = cast(Any, argparse)
    argparse_module._ = _argparse_message
    setattr(argparse_module, "ngettext", _argparse_plural_message)  # noqa: B010
