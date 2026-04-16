"""CLI entrypoint facade for lifeos_cli."""

from __future__ import annotations

from lifeos_cli.application.package_metadata import (
    get_installed_package_version as get_version,
)
from lifeos_cli.cli_support.parser import build_parser, main

__all__ = ["build_parser", "get_version", "main"]
