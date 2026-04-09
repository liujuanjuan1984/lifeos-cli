"""Top-level parser and CLI entrypoint assembly."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from importlib.metadata import PackageNotFoundError, version

from sqlalchemy.exc import SQLAlchemyError

from lifeos_cli.cli_support.config_commands import build_config_parser, build_init_parser
from lifeos_cli.cli_support.db_commands import build_db_parser
from lifeos_cli.cli_support.note_parser import build_note_parser
from lifeos_cli.cli_support.shared import build_epilog, print_database_runtime_error
from lifeos_cli.config import ConfigurationError


def get_version() -> str:
    """Return the installed distribution version when available."""
    try:
        return version("lifeos-cli")
    except PackageNotFoundError:
        return "0+unknown"


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""
    parser = argparse.ArgumentParser(
        prog="lifeos",
        description=(
            "Run LifeOS resource commands from the terminal.\n\n"
            "Command grammar:\n"
            "  lifeos <resource> <action> [arguments] [options]\n\n"
            "Resources model domains such as notes, configuration, and database setup.\n"
            "Actions are short verbs that operate on records or runtime state."
        ),
        epilog=build_epilog(
            examples=(
                "lifeos init",
                "lifeos config show",
                "lifeos db ping",
                'lifeos note add "Capture an idea"',
                'lifeos note search "meeting notes"',
            ),
            notes=(
                "Keep resource names singular so new command families stay consistent.",
                "Prefer short action verbs such as add, list, update, and delete.",
                "Use sub-namespaces such as `batch` when a resource needs grouped bulk operations.",
                "Each resource help page should explain scope, actions, and examples.",
                "Run `lifeos init` before using database-backed resource commands.",
            ),
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {get_version()}")
    subparsers = parser.add_subparsers(dest="resource", title="resources", metavar="resource")
    build_init_parser(subparsers)
    build_config_parser(subparsers)
    build_db_parser(subparsers)
    build_note_parser(subparsers)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)
    handler = getattr(args, "handler", None)
    if handler is None:
        parser.print_help()
        return 0
    try:
        return int(handler(args))
    except (ConfigurationError, SQLAlchemyError) as exc:
        return print_database_runtime_error(exc)
    except EOFError as exc:
        print(f"Initialization aborted: {exc}", file=sys.stderr)
        return 1
