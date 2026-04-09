"""CLI entrypoint facade for lifeos_cli."""

from __future__ import annotations

from lifeos_cli.cli_support.parser import build_parser, get_version, main

__all__ = ["build_parser", "get_version", "main"]
