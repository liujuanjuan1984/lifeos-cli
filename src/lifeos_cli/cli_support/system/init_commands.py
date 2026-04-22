"""Initialization CLI command definitions."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.system.config_handlers import handle_init
from lifeos_cli.i18n import cli_message as _


def build_init_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the init command."""
    init_parser = add_documented_parser(
        subparsers,
        "init",
        help_content=HelpContent(
            summary=_("messages.initialize_local_configuration_e9ffb190"),
            description=(
                _("messages.create_or_update_the_local_lifeos_config_file_and_verify_cf66f0df")
                + "\n\n"
                + _("messages.this_command_is_the_recommended_first_step_after_install_1a0a5e7a")
            ),
            examples=(
                "lifeos init",
                "lifeos init --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos",
                "lifeos init --non-interactive --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos "
                "--timezone America/Toronto --language zh-Hans --skip-migrate",
            ),
            notes=(
                _("messages.configuration_is_written_to_config_lifeos_config_toml_by_6ce42a8b"),
                _("messages.environment_variables_still_override_config_file_values_c0274685"),
                _("messages.database_credentials_may_be_stored_in_plain_text_in_the_41991e36"),
                _("messages.preference_values_are_also_stored_in_the_config_file_und_afe8076c"),
                _("messages.use_config_set_for_supported_follow_up_edits_when_you_do_c467771d"),
                _("messages.interactive_init_confirms_the_language_preference_becaus_5f111e5f"),
                _("messages.re_run_lifeos_init_at_any_time_to_update_stored_preferen_9af082f8"),
            ),
        ),
    )
    init_parser.add_argument(
        "--database-url",
        help=_("messages.postgresql_connection_url_to_persist_in_the_config_file_dc8217c6"),
    )
    init_parser.add_argument(
        "--schema",
        default=None,
        help=_("messages.postgresql_schema_name_to_use_for_application_tables_254912fb"),
    )
    init_parser.add_argument(
        "--echo",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=_("messages.enable_sqlalchemy_sql_echo_logging_in_the_config_file_a513b583"),
    )
    init_parser.add_argument(
        "--timezone",
        default=None,
        help=_("messages.default_iana_timezone_for_local_day_boundaries_and_time_2bd0858b"),
    )
    init_parser.add_argument(
        "--language",
        default=None,
        help=_("messages.preferred_language_tag_for_example_en_en_ca_or_zh_hans_c30cbff9"),
    )
    init_parser.add_argument(
        "--day-starts-at",
        default=None,
        help=_("messages.local_day_boundary_in_hh_mm_used_for_future_time_based_g_c4d3fd2c"),
    )
    init_parser.add_argument(
        "--week-starts-on",
        default=None,
        help=_("messages.preferred_first_day_of_week_monday_or_sunday_f1233193"),
    )
    init_parser.add_argument(
        "--vision-experience-rate-per-hour",
        type=int,
        default=None,
        help=_("messages.default_vision_experience_points_gained_per_hour_of_actu_a9875db0"),
    )
    init_parser.add_argument(
        "--non-interactive",
        action="store_true",
        help=_("messages.do_not_prompt_for_missing_values_require_flags_or_existi_939fecc2"),
    )
    init_parser.add_argument(
        "--skip-ping",
        action="store_true",
        help=_("messages.do_not_check_database_connectivity_after_writing_the_con_fba245ae"),
    )
    init_parser.add_argument(
        "--skip-migrate",
        action="store_true",
        help=_("messages.do_not_run_database_migrations_after_writing_the_config_18352445"),
    )
    init_parser.set_defaults(handler=handle_init)
