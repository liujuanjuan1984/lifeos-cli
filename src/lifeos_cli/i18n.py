"""gettext-based i18n helpers for user-facing CLI text."""

from __future__ import annotations

import argparse
import gettext
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

from lifeos_cli.config import ConfigurationError, detect_default_language, get_preferences_settings

DOMAIN = "lifeos_cli"
LOCALES_DIR = Path(__file__).with_name("locales")
DEFAULT_LOCALE = "en"


def _identity(message: str) -> str:
    """Return one untranslated message literal for catalog extraction."""
    return message


ARGPARSE_MESSAGE_IDS = (
    _identity(" (default: %(default)s)"),
    _identity("%(heading)s:"),
    _identity("%(prog)s: error: %(message)s\n"),
    _identity("%r is not callable"),
    _identity(".__call__() not defined"),
    _identity("ambiguous option: %(option)s could match %(matches)s"),
    _identity('argument "-" with mode %r'),
    _identity("argument %(argument_name)s: %(message)s"),
    _identity("cannot have multiple subparser arguments"),
    _identity("cannot merge actions - two groups are named %r"),
    _identity("conflicting subparser alias: %s"),
    _identity("conflicting subparser: %s"),
    _identity("dest= is required for options like %r"),
    _identity("expected at least one argument"),
    _identity("expected at most one argument"),
    _identity("expected one argument"),
    _identity("ignored explicit argument %r"),
    _identity("invalid %(type)s value: %(value)r"),
    _identity("invalid choice: %(value)r (choose from %(choices)s)"),
    _identity("invalid conflict_resolution value: %r"),
    _identity("mutually exclusive arguments must be optional"),
    _identity("not allowed with argument %s"),
    _identity("one of the arguments %s is required"),
    _identity("options"),
    _identity("optional arguments"),
    _identity("positional arguments"),
    _identity("show this help message and exit"),
    _identity("subcommands"),
    _identity("the following arguments are required: %s"),
    _identity("unexpected option string: %s"),
    _identity("unknown parser %(parser_name)r (choices: %(choices)s)"),
    _identity("unrecognized arguments: %s"),
    _identity("usage: "),
)


def _normalize_locale_tag(locale_tag: str) -> str:
    """Convert a BCP-47-like tag into a gettext-friendly locale identifier."""
    return locale_tag.strip().replace("-", "_")


def _locale_candidates(locale_tag: str) -> list[str]:
    """Return gettext lookup candidates from most specific to least specific."""
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


@lru_cache(maxsize=16)
def _load_translation(locale_tag: str) -> gettext.NullTranslations:
    """Load the gettext translation object for one locale."""
    return gettext.translation(
        DOMAIN,
        localedir=LOCALES_DIR,
        languages=_locale_candidates(locale_tag),
        fallback=True,
    )


def gettext_message(message: str) -> str:
    """Translate one user-facing message with locale fallback."""
    return _load_translation(resolve_locale()).gettext(message)


def ngettext_message(singular: str, plural: str, count: int) -> str:
    """Translate one user-facing pluralizable message with locale fallback."""
    return _load_translation(resolve_locale()).ngettext(singular, plural, count)


def configure_argparse_translations() -> None:
    """Route argparse built-in help and error text through the active gettext catalog."""
    argparse_module = cast(Any, argparse)
    argparse_module._ = gettext_message
    argparse_module.ngettext = ngettext_message
