"""Shared package metadata helpers."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version


def get_installed_package_version() -> str:
    """Return the installed distribution version when available."""
    try:
        return version("lifeos-cli")
    except PackageNotFoundError:
        return "0+unknown"
