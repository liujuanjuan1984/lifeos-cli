"""Database maintenance CLI commands."""

from __future__ import annotations

import argparse

from lifeos_cli.application.database import (
    ping_configured_database,
    upgrade_configured_database,
)
from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.runtime_utils import (
    make_sync_handler,
)
from lifeos_cli.i18n import cli_message as _


async def run_db_ping(_: argparse.Namespace) -> int:
    """Ping the configured database and print a success message."""
    await ping_configured_database()
    print("Database connection succeeded.")
    return 0


def run_db_upgrade(_: argparse.Namespace) -> int:
    """Apply database migrations and print a success message."""
    upgrade_configured_database()
    print("Database migrations are up to date.")
    return 0


def build_db_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the database command tree."""
    db_parser = add_documented_help_parser(
        subparsers,
        "db",
        help_content=HelpContent(
            summary=_("messages.run_database_maintenance_commands_5791d225"),
            description=(
                _("messages.inspect_database_connectivity_and_apply_migrations_f3271993")
                + "\n\n"
                + _("messages.these_commands_operate_on_the_database_configured_throug_9ee5be9f")
            ),
            examples=(
                "lifeos db ping",
                "lifeos db upgrade",
            ),
            notes=(
                _("messages.use_ping_to_validate_the_current_connection_settings_wit_ba1ec864"),
                _("messages.use_upgrade_when_the_configured_database_schema_needs_to_96fbb948"),
            ),
        ),
    )
    db_subparsers = db_parser.add_subparsers(
        dest="db_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    ping_parser = add_documented_parser(
        db_subparsers,
        "ping",
        help_content=HelpContent(
            summary=_("messages.check_database_connectivity_2b474dbe"),
            description=_(
                "messages.open_a_database_connection_and_run_a_minimal_health_chec_abe2868b"
            ),
            examples=("lifeos db ping",),
            notes=(
                _("messages.use_this_before_db_upgrade_when_you_first_need_to_confir_38589c5e"),
            ),
        ),
    )
    ping_parser.set_defaults(handler=make_sync_handler(run_db_ping))

    upgrade_parser = add_documented_parser(
        db_subparsers,
        "upgrade",
        help_content=HelpContent(
            summary=_("messages.apply_migrations_c714f550"),
            description=_(
                "messages.apply_alembic_migrations_to_the_configured_postgresql_da_b7a89035"
            ),
            examples=("lifeos db upgrade",),
            notes=(
                _("messages.this_updates_schema_state_in_the_database_it_does_not_re_b8e2d289"),
                _("messages.use_db_ping_first_if_you_are_unsure_the_current_connecti_14e97ded"),
            ),
        ),
    )
    upgrade_parser.set_defaults(handler=run_db_upgrade)
