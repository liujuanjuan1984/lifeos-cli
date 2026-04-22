"""Configuration CLI command definitions."""

from __future__ import annotations

import argparse

from lifeos_cli.application.configuration import SUPPORTED_CONFIG_KEYS
from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.system.config_handlers import (
    handle_config_set,
    handle_config_show,
)
from lifeos_cli.i18n import cli_message as _


def build_config_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the config command tree."""
    config_parser = add_documented_help_parser(
        subparsers,
        "config",
        help_content=HelpContent(
            summary=_("messages.inspect_runtime_configuration_5ff86c21"),
            description=(
                _("messages.inspect_the_effective_configuration_resolved_from_the_co_c04cfb74")
            ),
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
                "lifeos config set preferences.timezone America/Toronto",
            ),
            notes=(
                _("messages.use_show_to_inspect_effective_values_after_config_file_a_2da4d6cb"),
                _("messages.use_set_to_persist_supported_keys_without_re_running_the_0cda8725"),
                _("messages.use_set_to_persist_supported_keys_into_the_local_config_408dea35"),
                _("messages.environment_variables_still_override_config_file_values_27263286"),
                _("messages.agents_should_inspect_preference_language_before_writing_8d58ea38"),
            ),
        ),
    )
    config_subparsers = config_parser.add_subparsers(
        dest="config_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    show_parser = add_documented_parser(
        config_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_effective_configuration_71b5581d"),
            description=_(
                "messages.print_the_effective_config_values_used_by_the_current_pr_5bf102b8"
            ),
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
            ),
            notes=(
                _("messages.database_urls_hide_passwords_by_default_use_show_secrets_49db5ced"),
                _("messages.preferences_are_resolved_from_the_preferences_toml_table_5a442955"),
                _("messages.use_config_set_to_persist_one_supported_key_after_review_407eb928"),
                _("messages.agents_should_use_the_effective_language_for_human_autho_17f7c13c"),
            ),
        ),
    )
    show_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help=_("messages.print_sensitive_values_such_as_database_passwords_in_ful_d7c832c0"),
    )
    show_parser.set_defaults(handler=handle_config_show)

    set_parser = add_documented_parser(
        config_subparsers,
        "set",
        help_content=HelpContent(
            summary=_("messages.persist_one_config_value_8252ee38"),
            description=_(
                "messages.write_one_supported_config_key_to_the_local_config_file_74c0d967"
            ),
            examples=(
                "lifeos config set preferences.timezone America/Toronto",
                "lifeos config set database.echo true",
                "lifeos config set database.url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos "
                "--show-secrets",
                "lifeos config set preferences.vision_experience_rate_per_hour 120",
            ),
            notes=(
                _("messages.this_command_writes_the_config_file_not_environment_vari_1aac33d2"),
                _("messages.supported_keys_keys_c7912d33").format(
                    keys=", ".join(SUPPORTED_CONFIG_KEYS)
                ),
                _("messages.use_lifeos_init_for_first_time_bootstrap_or_when_changin_bca74f40"),
                _("messages.use_lifeos_init_schema_name_to_change_the_database_schem_14d6ef7b"),
                _("messages.use_config_show_to_inspect_the_effective_values_after_en_02086df2"),
            ),
        ),
    )
    set_parser.add_argument("key", help=_("messages.supported_config_key_to_update_df3bbe1e"))
    set_parser.add_argument(
        "value", help=_("messages.new_value_to_persist_for_the_selected_key_4d4def8a")
    )
    set_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help=_("messages.print_sensitive_values_such_as_database_passwords_in_ful_cd6ace16"),
    )
    set_parser.set_defaults(handler=handle_config_set)
