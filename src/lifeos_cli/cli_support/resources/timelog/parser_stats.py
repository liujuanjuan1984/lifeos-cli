"""Builder helpers for timelog stats commands."""

from __future__ import annotations

import argparse
from datetime import date
from functools import partial

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_date_range_arguments
from lifeos_cli.cli_support.resources.timelog.handlers import (
    handle_timelog_stats_day_async,
    handle_timelog_stats_period_async,
    handle_timelog_stats_range_async,
    handle_timelog_stats_rebuild_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def _month_value(value: str) -> date:
    """Parse a YYYY-MM month value."""
    return date.fromisoformat(f"{value}-01")


def build_timelog_stats_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog stats command tree."""
    stats_parser = add_documented_help_parser(
        timelog_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Query timelog stats grouped by area"),
            description=_("Query timelog stats grouped by area."),
            examples=(
                "lifeos timelog stats day --help",
                "lifeos timelog stats range --help",
                "lifeos timelog stats rebuild --help",
            ),
            notes=(
                _("Use `day`, `week`, `month`, and `year` for calendar-based views."),
                _("Use `range` for arbitrary windows and `rebuild` to refresh persisted stats."),
                _("Stats are grouped only by area; task effort remains a separate task feature."),
                _(
                    "Run `timelog stats rebuild` after upgrading older datasets or importing "
                    "historical timelogs so persisted stats match historical records."
                ),
            ),
        ),
    )
    stats_subparsers = stats_parser.add_subparsers(
        dest="timelog_stats_command", title=_("stats actions"), metavar=_("stats-action")
    )

    stats_day_parser = add_documented_parser(
        stats_subparsers,
        "day",
        help_content=HelpContent(
            summary=_("Show one day of timelog stats grouped by area"),
            description=_("Show one local operational day of timelog stats grouped by area."),
            examples=("lifeos timelog stats day --date 2026-04-10",),
        ),
    )
    stats_day_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("Local operational date in YYYY-MM-DD format"),
    )
    stats_day_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_day_async))

    stats_range_parser = add_documented_parser(
        stats_subparsers,
        "range",
        help_content=HelpContent(
            summary=_("Show a date range of timelog stats grouped by area"),
            description=_("Show one local date range of timelog stats grouped by area."),
            examples=("lifeos timelog stats range --date 2026-04-01 --date 2026-04-30",),
            notes=(
                _(
                    "Repeat `--date` once for one local date or twice for one inclusive "
                    "local-date range."
                ),
            ),
        ),
    )
    add_date_range_arguments(
        stats_range_parser,
        date_help=_(
            "Repeat once for one local date or twice for one inclusive local-date range "
            "in YYYY-MM-DD format"
        ),
    )
    stats_range_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_range_async))

    stats_week_parser = add_documented_parser(
        stats_subparsers,
        "week",
        help_content=HelpContent(
            summary=_("Show one week of timelog stats grouped by area"),
            description=_("Show one configured local week of timelog stats grouped by area."),
            examples=("lifeos timelog stats week --date 2026-04-10",),
            notes=(_("The week boundary follows the configured `week_starts_on` preference."),),
        ),
    )
    stats_week_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("Reference local date in YYYY-MM-DD format"),
    )
    stats_week_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="week"))
    )

    stats_month_parser = add_documented_parser(
        stats_subparsers,
        "month",
        help_content=HelpContent(
            summary=_("Show one month of timelog stats grouped by area"),
            description=_("Show one calendar month of timelog stats grouped by area."),
            examples=("lifeos timelog stats month --month 2026-04",),
        ),
    )
    stats_month_parser.add_argument(
        "--month",
        required=True,
        type=_month_value,
        help=_("Calendar month in YYYY-MM format"),
    )
    stats_month_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="month"))
    )

    stats_year_parser = add_documented_parser(
        stats_subparsers,
        "year",
        help_content=HelpContent(
            summary=_("Show one year of timelog stats grouped by area"),
            description=_("Show one calendar year of timelog stats grouped by area."),
            examples=("lifeos timelog stats year --year 2026",),
        ),
    )
    stats_year_parser.add_argument(
        "--year",
        required=True,
        type=int,
        help=_("Calendar year, for example 2026"),
    )
    stats_year_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="year"))
    )

    stats_rebuild_parser = add_documented_parser(
        stats_subparsers,
        "rebuild",
        help_content=HelpContent(
            summary=_("Rebuild persisted timelog stats grouped by area"),
            description=(
                _(
                    "Rebuild persisted day, week, month, and year timelog stats grouped by "
                    "area for one selected local scope."
                )
            ),
            examples=(
                "lifeos timelog stats rebuild --date 2026-04-10",
                "lifeos timelog stats rebuild --date 2026-01-01 --date 2026-03-31",
                "lifeos timelog stats rebuild --all",
            ),
            notes=(
                _("Use rebuild after upgrading older datasets or importing historical timelogs."),
                _("Rebuild uses the configured timezone and `day_starts_at` preference."),
                _("Repeat `--date` twice for one inclusive local-date rebuild range."),
            ),
        ),
    )
    add_date_range_arguments(
        stats_rebuild_parser,
        date_help=_(
            "Repeat once for one local operational date or twice for one inclusive "
            "local-date rebuild range in YYYY-MM-DD format"
        ),
    )
    stats_rebuild_parser.add_argument(
        "--all",
        dest="rebuild_all",
        action="store_true",
        help=_("Rebuild every local date touched by active timelogs with linked areas"),
    )
    stats_rebuild_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_rebuild_async))
