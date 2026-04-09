"""Top-level parser and CLI entrypoint assembly."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from importlib.metadata import PackageNotFoundError, version

from sqlalchemy.exc import SQLAlchemyError

from lifeos_cli.cli_support.help_utils import build_epilog
from lifeos_cli.cli_support.resources.area.parser import build_area_parser
from lifeos_cli.cli_support.resources.note.parser import build_note_parser
from lifeos_cli.cli_support.resources.people.parser import build_people_parser
from lifeos_cli.cli_support.resources.tag.parser import build_tag_parser
from lifeos_cli.cli_support.resources.task.parser import build_task_parser
from lifeos_cli.cli_support.resources.vision.parser import build_vision_parser
from lifeos_cli.cli_support.runtime_utils import print_database_runtime_error
from lifeos_cli.cli_support.system.config_commands import (
    build_config_parser,
    build_init_parser,
)
from lifeos_cli.cli_support.system.db_commands import build_db_parser
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
                'lifeos area add "Health"',
                'lifeos people add "Alice"',
                'lifeos vision add "Launch lifeos-cli" --area-id <area-id>',
                'lifeos task add "Draft release plan" --vision-id <vision-id>',
                'lifeos note add "Capture an idea"',
                'lifeos note search "meeting notes"',
            ),
            notes=(
                "Prefer short, stable resource names so new command families stay consistent.",
                "Use natural exceptions such as `people` when they are clearer than "
                "forced regular forms.",
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
    build_area_parser(subparsers)
    build_tag_parser(subparsers)
    build_people_parser(subparsers)
    build_vision_parser(subparsers)
    build_task_parser(subparsers)
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
