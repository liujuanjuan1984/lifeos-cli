"""Preference endpoints for the local Web UI."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lifeos_cli.application.configuration import set_runtime_config_value
from lifeos_cli.config import ConfigurationError, get_preferences_settings

router = APIRouter(prefix="/preferences", tags=["preferences"])

_VISIBLE_MODULES = [
    "visions",
    "habits",
    "planning",
    "timelog",
    "insights",
    "calendar",
    "notes",
    "persons",
    "settings",
]

_THEMES = [
    "system",
    "fresh",
    "cupcake",
    "bumblebee",
    "emerald",
    "corporate",
    "synthwave",
    "retro",
    "cyberpunk",
    "valentine",
    "halloween",
    "garden",
    "forest",
    "aqua",
    "lofi",
    "pastel",
    "fantasy",
    "wireframe",
    "luxury",
    "dracula",
    "cmyk",
    "autumn",
    "business",
    "acid",
    "lemonade",
    "night",
    "coffee",
    "winter",
]

_CONFIG_KEY_MAP = {
    "system.timezone": "preferences.timezone",
    "visions.experience_rate_per_hour": "preferences.vision_experience_rate_per_hour",
}

_STATIC_DEFAULTS: dict[str, Any] = {
    "appearance.theme": "system",
    "calendar.first_day_of_week": 1,
    "calendar.system": "gregorian",
    "dashboard.dimension_order": [],
    "navigation.visible_modules": _VISIBLE_MODULES,
    "notes.card_min_collapsed_lines": 5,
    "notes.export_planning.include_cycle_notes": False,
    "notes.export_planning.include_task_notes": True,
    "planning.show_habit_actions": True,
    "tasks.default_planning_preset": "none",
    "timeLog.auto_set_task_planning": False,
}

_META: dict[str, dict[str, Any]] = {
    "appearance.theme": {
        "allowed_values": _THEMES,
        "description": "LifeOS Web UI theme.",
        "module": "appearance",
    },
    "calendar.system": {
        "allowed_values": ["gregorian", "mayan_13_moon"],
        "description": "Calendar system used by schedule and task planning views.",
        "module": "calendar",
    },
    "calendar.first_day_of_week": {
        "allowed_values": [1, 2, 3, 4, 5, 6, 7],
        "description": "First weekday used in calendar views.",
        "module": "calendar",
    },
    "navigation.visible_modules": {
        "allowed_values": _VISIBLE_MODULES,
        "description": "Visible LifeOS modules in the navigation rail.",
        "module": "navigation",
    },
}

_VALUES: dict[str, Any] = dict(_STATIC_DEFAULTS)


class PreferenceUpdate(BaseModel):
    """Preference update payload."""

    value: Any
    module: str | None = None


def _config_preference_value(key: str) -> Any:
    preferences = get_preferences_settings()
    if key == "system.timezone":
        return preferences.timezone
    if key == "visions.experience_rate_per_hour":
        return preferences.vision_experience_rate_per_hour
    return None


def _default_value(key: str) -> Any:
    if key in _CONFIG_KEY_MAP:
        return _config_preference_value(key)
    return _STATIC_DEFAULTS.get(key)


def _preference_response(key: str) -> dict[str, Any]:
    if key in _CONFIG_KEY_MAP:
        value = _config_preference_value(key)
    else:
        value = _VALUES.get(key, _STATIC_DEFAULTS.get(key))
    meta = {
        "default_value": _default_value(key),
        "module": key.split(".", 1)[0],
    }
    meta.update(_META.get(key, {}))
    return {"key": key, "value": value, "meta": meta}


@router.get("/{key}")
async def get_preference(key: str) -> dict[str, Any]:
    """Return local Web preference values."""
    return _preference_response(key)


@router.put("/{key}")
async def set_preference(key: str, payload: PreferenceUpdate) -> dict[str, Any]:
    """Persist local Web preference values."""
    config_key = _CONFIG_KEY_MAP.get(key)
    if config_key is not None:
        try:
            set_runtime_config_value(key=config_key, value=str(payload.value))
        except ConfigurationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        response = _preference_response(key)
        if payload.module:
            response["meta"]["module"] = payload.module
        return response

    _VALUES[key] = payload.value
    response = _preference_response(key)
    if payload.module:
        response["meta"]["module"] = payload.module
    return response
