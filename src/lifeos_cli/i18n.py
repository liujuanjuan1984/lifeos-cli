"""gettext-based i18n helpers for user-facing CLI text."""

from __future__ import annotations

import gettext
import os
import argparse
from functools import lru_cache
from pathlib import Path

from lifeos_cli.config import ConfigurationError, detect_default_language, get_preferences_settings

DOMAIN = "lifeos_cli"
LOCALES_DIR = Path(__file__).with_name("locales")
DEFAULT_LOCALE = "en"
_ = lambda message: message
ARGPARSE_MESSAGE_IDS = (
    _(" (default: %(default)s)"),
    _("%(heading)s:"),
    _("%(prog)s: error: %(message)s\n"),
    _("%r is not callable"),
    _(".__call__() not defined"),
    _("ambiguous option: %(option)s could match %(matches)s"),
    _("argument \"-\" with mode %r"),
    _("argument %(argument_name)s: %(message)s"),
    _("cannot have multiple subparser arguments"),
    _("cannot merge actions - two groups are named %r"),
    _("conflicting subparser alias: %s"),
    _("conflicting subparser: %s"),
    _("dest= is required for options like %r"),
    _("expected at least one argument"),
    _("expected at most one argument"),
    _("expected one argument"),
    _("ignored explicit argument %r"),
    _("invalid %(type)s value: %(value)r"),
    _("invalid choice: %(value)r (choose from %(choices)s)"),
    _("invalid conflict_resolution value: %r"),
    _("mutually exclusive arguments must be optional"),
    _("not allowed with argument %s"),
    _("one of the arguments %s is required"),
    _("options"),
    _("positional arguments"),
    _("show this help message and exit"),
    _("subcommands"),
    _("the following arguments are required: %s"),
    _("unexpected option string: %s"),
    _("unknown parser %(parser_name)r (choices: %(choices)s)"),
    _("unrecognized arguments: %s"),
    _("usage: "),
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


def pgettext_message(context: str, message: str) -> str:
    """Translate one contextualized message with locale fallback."""
    return _load_translation(resolve_locale()).pgettext(context, message)


def configure_argparse_translations() -> None:
    """Route argparse built-in help and error text through the active gettext catalog."""
    setattr(argparse, "_", gettext_message)
    setattr(argparse, "ngettext", ngettext_message)
