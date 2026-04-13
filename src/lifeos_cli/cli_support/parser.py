"""Top-level parser and CLI entrypoint assembly."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from importlib.metadata import PackageNotFoundError, metadata, version

from sqlalchemy.exc import SQLAlchemyError

from lifeos_cli.cli_support.help_utils import build_epilog
from lifeos_cli.cli_support.resources.area.parser import build_area_parser
from lifeos_cli.cli_support.resources.data.parser import build_data_parser
from lifeos_cli.cli_support.resources.event.parser import build_event_parser
from lifeos_cli.cli_support.resources.habit.parser import build_habit_parser
from lifeos_cli.cli_support.resources.habit_action.parser import build_habit_action_parser
from lifeos_cli.cli_support.resources.note.parser import build_note_parser
from lifeos_cli.cli_support.resources.people.parser import build_people_parser
from lifeos_cli.cli_support.resources.schedule.parser import build_schedule_parser
from lifeos_cli.cli_support.resources.tag.parser import build_tag_parser
from lifeos_cli.cli_support.resources.task.parser import build_task_parser
from lifeos_cli.cli_support.resources.timelog.parser import build_timelog_parser
from lifeos_cli.cli_support.resources.vision.parser import build_vision_parser
from lifeos_cli.cli_support.runtime_utils import print_database_runtime_error
from lifeos_cli.cli_support.system.config_commands import (
    build_config_parser,
    build_init_parser,
)
from lifeos_cli.cli_support.system.db_commands import build_db_parser
from lifeos_cli.config import ConfigurationError
from lifeos_cli.i18n import configure_argparse_translations
from lifeos_cli.i18n import gettext_message as _

CLI_BRAND_BANNER = "+-------------------+\n|    lifeos-cli     |\n+-------------------+"
PROJECT_REPOSITORY_URL_FALLBACK = "https://github.com/liujuanjuan1984/lifeos-cli"
PROJECT_ISSUES_URL_FALLBACK = "https://github.com/liujuanjuan1984/lifeos-cli/issues"


def get_version() -> str:
    """Return the installed distribution version when available."""
    try:
        return version("lifeos-cli")
    except PackageNotFoundError:
        return "0+unknown"


def get_project_urls() -> tuple[str, str]:
    """Return repository and issue tracker URLs from package metadata when available."""
    repository_url = PROJECT_REPOSITORY_URL_FALLBACK
    issues_url = PROJECT_ISSUES_URL_FALLBACK
    try:
        distribution_metadata = metadata("lifeos-cli")
    except PackageNotFoundError:
        return repository_url, issues_url
    for project_url in distribution_metadata.get_all("Project-URL", []):
        label, separator, url = project_url.partition(",")
        if not separator:
            continue
        normalized_label = label.strip().lower()
        normalized_url = url.strip()
        if normalized_label == "repository":
            repository_url = normalized_url
        elif normalized_label == "issues":
            issues_url = normalized_url
    return repository_url, issues_url


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""
    configure_argparse_translations()
    repository_url, issues_url = get_project_urls()
    parser = argparse.ArgumentParser(
        prog="lifeos",
        description=(
            CLI_BRAND_BANNER
            + "\n\n"
            + _("Run LifeOS resource commands from the terminal.")
            + "\n\n"
            + _("Command grammar:")
            + "\n"
            "  lifeos <resource> <action> [arguments] [options]\n\n"
            + _("Resources model domains such as areas, people, visions, tasks, and notes.")
            + "\n"
            + _(
                "Time-oriented domains use `event` for planned schedule blocks and `timelog` "
                "for actual time records."
            )
            + "\n"
            + _("Use `schedule` for aggregated day and range views across planned work.")
            + "\n"
            + _("Habits and habit actions are exposed as separate top-level resources.")
            + "\n"
            + _("System commands such as init, config, and db manage runtime setup.")
            + "\n"
            + _("Use `data` for canonical import/export, bundle backup, and batch operations.")
            + "\n"
            + _("Actions are short verbs that operate on records or runtime state.")
        ),
        epilog=build_epilog(
            examples=(
                "lifeos init",
                "lifeos config show",
                "lifeos config set preferences.timezone America/Toronto",
                "lifeos db ping",
                "lifeos data export all --output lifeos-bundle.zip",
                'lifeos area add "Health"',
                'lifeos people add "Alice"',
                'lifeos vision add "Launch lifeos-cli" --area-id <area-id>',
                'lifeos task add "Draft release plan" --vision-id <vision-id>',
                'lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00',
                'lifeos event add "Focus Work" --type timeblock '
                "--start-time 2026-04-10T13:00:00-04:00",
                "lifeos schedule show --date 2026-04-10",
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 '
                "--end-time 2026-04-10T14:30:00-04:00",
                'lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21',
                "lifeos habit-action list --action-date 2026-04-09",
                'lifeos note add "Capture an idea"',
                'lifeos note search "meeting notes"',
            ),
            notes=(
                _("Prefer short, stable resource names so new command families stay consistent."),
                _(
                    "Use natural exceptions such as `people` when they are clearer than "
                    "forced regular forms."
                ),
                _("Prefer short action verbs such as add, list, update, and delete."),
                _(
                    "For structured resources, prefer `list` with filters and pagination over "
                    "separate query verbs."
                ),
                _(
                    "Use sub-namespaces such as `batch` when a resource needs grouped bulk "
                    "operations."
                ),
                _(
                    "Use `lifeos <resource> --help` and `lifeos <resource> <action> --help` as the "
                    "primary command reference."
                ),
                _("Each resource help page should explain scope, actions, and examples."),
                _(
                    "When automation acts on behalf of a human, model the acting subject "
                    "explicitly through `people` and repeated `--person-id` flags."
                ),
                _(
                    "Agents that create records for a human should run `lifeos config show` and "
                    "use the effective preference language for titles, descriptions, and note "
                    "content unless the human explicitly asks for another language."
                ),
                _("Keep human-only work, agent-only work, and truly shared work distinct."),
                _("Run `lifeos init` before using database-backed resource commands."),
                _("Repository: {url}").format(url=repository_url),
                _("Issues: {url}").format(url=issues_url),
                _("Report bugs and request features through the issue tracker."),
            ),
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {get_version()}",
        help=_("Show the program version and exit"),
    )
    subparsers = parser.add_subparsers(
        dest="resource",
        title=_("resources"),
        metavar=_("resource"),
    )
    build_init_parser(subparsers)
    build_config_parser(subparsers)
    build_db_parser(subparsers)
    build_data_parser(subparsers)
    build_area_parser(subparsers)
    build_event_parser(subparsers)
    build_schedule_parser(subparsers)
    build_tag_parser(subparsers)
    build_people_parser(subparsers)
    build_vision_parser(subparsers)
    build_task_parser(subparsers)
    build_timelog_parser(subparsers)
    build_habit_parser(subparsers)
    build_habit_action_parser(subparsers)
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
