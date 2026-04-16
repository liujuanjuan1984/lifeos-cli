"""Semantic accessors for runtime user preferences."""

from __future__ import annotations

from lifeos_cli.config import get_preferences_settings


def get_preferred_language() -> str:
    """Return the configured language tag for user-facing text."""
    return get_preferences_settings().language


def get_preferred_timezone_name() -> str:
    """Return the configured IANA timezone name."""
    return get_preferences_settings().timezone


def get_preferred_day_starts_at() -> str:
    """Return the configured local day boundary in HH:MM format."""
    return get_preferences_settings().day_starts_at


def get_preferred_week_starts_on() -> str:
    """Return the configured first day of the week."""
    return get_preferences_settings().week_starts_on


def get_preferred_vision_experience_rate_per_hour() -> int:
    """Return the configured default vision experience rate."""
    return get_preferences_settings().vision_experience_rate_per_hour
