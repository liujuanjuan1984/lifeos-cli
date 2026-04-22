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
from lifeos_cli.i18n import cli_message as _


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
            summary=_("messages.query_timelog_stats_grouped_by_area_ca3152c7"),
            description=_("messages.query_timelog_stats_grouped_by_area_39243c66"),
            examples=(
                "lifeos timelog stats day --help",
                "lifeos timelog stats range --help",
                "lifeos timelog stats rebuild --help",
            ),
            notes=(
                _("messages.use_day_week_month_and_year_for_calendar_based_views_0e14a64c"),
                _("messages.use_range_for_arbitrary_windows_and_rebuild_to_refresh_p_5ea30eb0"),
                _("messages.stats_are_grouped_only_by_area_task_effort_remains_a_sep_26e5d1ce"),
                _("messages.run_timelog_stats_rebuild_after_upgrading_older_datasets_90d754c9"),
            ),
        ),
    )
    stats_subparsers = stats_parser.add_subparsers(
        dest="timelog_stats_command",
        title=_("messages.stats_actions_e3ba69ec"),
        metavar=_("messages.stats_action_fd2c6b3f"),
    )

    stats_day_parser = add_documented_parser(
        stats_subparsers,
        "day",
        help_content=HelpContent(
            summary=_("messages.show_one_day_of_timelog_stats_grouped_by_area_37b28f71"),
            description=_(
                "messages.show_one_local_operational_day_of_timelog_stats_grouped_65c8827e"
            ),
            examples=("lifeos timelog stats day --date 2026-04-10",),
        ),
    )
    stats_day_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("messages.local_operational_date_in_yyyy_mm_dd_format_00a49d67"),
    )
    stats_day_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_day_async))

    stats_range_parser = add_documented_parser(
        stats_subparsers,
        "range",
        help_content=HelpContent(
            summary=_("messages.show_a_date_range_of_timelog_stats_grouped_by_area_63c80ab8"),
            description=_(
                "messages.show_one_local_date_range_of_timelog_stats_grouped_by_ar_7834996a"
            ),
            examples=("lifeos timelog stats range --date 2026-04-01 --date 2026-04-30",),
            notes=(
                _("messages.repeat_date_once_for_one_local_date_or_twice_for_one_inc_0574ebc4"),
            ),
        ),
    )
    add_date_range_arguments(
        stats_range_parser,
        date_help=_("messages.repeat_once_for_one_local_date_or_twice_for_one_inclusiv_b2bcbda1"),
    )
    stats_range_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_range_async))

    stats_week_parser = add_documented_parser(
        stats_subparsers,
        "week",
        help_content=HelpContent(
            summary=_("messages.show_one_week_of_timelog_stats_grouped_by_area_9678eb7e"),
            description=_(
                "messages.show_one_configured_local_week_of_timelog_stats_grouped_4812835a"
            ),
            examples=("lifeos timelog stats week --date 2026-04-10",),
            notes=(_("messages.the_week_boundary_follows_the_configured_week_starts_on_60dc76e6"),),
        ),
    )
    stats_week_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("messages.reference_local_date_in_yyyy_mm_dd_format_0b523302"),
    )
    stats_week_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="week"))
    )

    stats_month_parser = add_documented_parser(
        stats_subparsers,
        "month",
        help_content=HelpContent(
            summary=_("messages.show_one_month_of_timelog_stats_grouped_by_area_796e6605"),
            description=_(
                "messages.show_one_calendar_month_of_timelog_stats_grouped_by_area_769786da"
            ),
            examples=("lifeos timelog stats month --month 2026-04",),
        ),
    )
    stats_month_parser.add_argument(
        "--month",
        required=True,
        type=_month_value,
        help=_("messages.calendar_month_in_yyyy_mm_format_b90d0ba0"),
    )
    stats_month_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="month"))
    )

    stats_year_parser = add_documented_parser(
        stats_subparsers,
        "year",
        help_content=HelpContent(
            summary=_("messages.show_one_year_of_timelog_stats_grouped_by_area_df47ef6c"),
            description=_(
                "messages.show_one_calendar_year_of_timelog_stats_grouped_by_area_76b78cb8"
            ),
            examples=("lifeos timelog stats year --year 2026",),
        ),
    )
    stats_year_parser.add_argument(
        "--year",
        required=True,
        type=int,
        help=_("messages.calendar_year_for_example_2026_62d1d1a0"),
    )
    stats_year_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="year"))
    )

    stats_rebuild_parser = add_documented_parser(
        stats_subparsers,
        "rebuild",
        help_content=HelpContent(
            summary=_("messages.rebuild_persisted_timelog_stats_grouped_by_area_13914f8e"),
            description=(
                _("messages.rebuild_persisted_day_week_month_and_year_timelog_stats_ef0ea51d")
            ),
            examples=(
                "lifeos timelog stats rebuild --date 2026-04-10",
                "lifeos timelog stats rebuild --date 2026-01-01 --date 2026-03-31",
                "lifeos timelog stats rebuild --all",
            ),
            notes=(
                _("messages.use_rebuild_after_upgrading_older_datasets_or_importing_c754514b"),
                _("messages.rebuild_uses_the_configured_timezone_and_day_starts_at_p_0db3f6b6"),
                _("messages.repeat_date_twice_for_one_inclusive_local_date_rebuild_r_b68bf97b"),
            ),
        ),
    )
    add_date_range_arguments(
        stats_rebuild_parser,
        date_help=_("messages.repeat_once_for_one_local_operational_date_or_twice_for_0633c849"),
    )
    stats_rebuild_parser.add_argument(
        "--all",
        dest="rebuild_all",
        action="store_true",
        help=_("messages.rebuild_every_local_date_touched_by_active_timelogs_with_0371a751"),
    )
    stats_rebuild_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_rebuild_async))
