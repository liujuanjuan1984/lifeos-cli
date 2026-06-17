"""Finance resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.finance.handlers import (
    handle_finance_node_add_async,
    handle_finance_node_delete_async,
    handle_finance_node_update_async,
    handle_finance_snapshot_add_async,
    handle_finance_snapshot_list_async,
    handle_finance_snapshot_show_async,
    handle_finance_tree_add_async,
    handle_finance_tree_ensure_default_async,
    handle_finance_tree_list_async,
    handle_finance_tree_show_async,
    parse_snapshot_entry,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_user_datetime_value


def build_finance_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the finance command tree."""
    finance_parser = add_documented_help_parser(
        subparsers,
        "finance",
        help_content=HelpContent(
            summary="Manage unified finance trees and snapshots.",
            description=(
                "Create finance trees, nodes, and snapshots for balance-sheet, cashflow, "
                "or custom financial tracking. Balance and cashflow are presets over the "
                "same underlying tree and snapshot model."
            ),
            examples=(
                "lifeos finance tree-add --help",
                "lifeos finance node-add --help",
                "lifeos finance snapshot-add --help",
            ),
            notes=(
                "Use `purpose=balance` for instant net-worth snapshots.",
                "Use `purpose=cashflow` for period income and spending snapshots.",
            ),
        ),
    )
    finance_subparsers = finance_parser.add_subparsers(
        dest="finance_command",
        title="actions",
        metavar="action",
    )

    tree_add = add_documented_parser(
        finance_subparsers,
        "tree-add",
        help_content=HelpContent(
            summary="Create a finance tree.",
            description="Create one unified finance tree for balance, cashflow, or custom use.",
            examples=(
                'lifeos finance tree-add "Balance Sheet" --purpose balance --time-mode instant',
                'lifeos finance tree-add "Cashflow" --purpose cashflow --time-mode period',
            ),
        ),
    )
    tree_add.add_argument("name")
    tree_add.add_argument("--purpose", default="custom", choices=("balance", "cashflow", "custom"))
    tree_add.add_argument("--time-mode", choices=("instant", "period"))
    tree_add.add_argument("--primary-currency", default="USD")
    tree_add.add_argument("--display-order", type=int, default=0)
    tree_add.add_argument("--default", action="store_true")
    tree_add.set_defaults(handler=make_sync_handler(handle_finance_tree_add_async))

    tree_list = add_documented_parser(
        finance_subparsers,
        "tree-list",
        help_content=HelpContent(
            summary="List finance trees.",
            description="List active finance trees, optionally filtered by purpose.",
            examples=("lifeos finance tree-list", "lifeos finance tree-list --purpose balance"),
        ),
    )
    tree_list.add_argument("--purpose", choices=("balance", "cashflow", "custom"))
    add_include_deleted_argument(tree_list, noun="finance trees")
    add_limit_offset_arguments(tree_list)
    tree_list.set_defaults(handler=make_sync_handler(handle_finance_tree_list_async))

    tree_show = add_documented_parser(
        finance_subparsers,
        "tree-show",
        help_content=HelpContent(
            summary="Show a finance tree.",
            description="Show one finance tree and its node hierarchy.",
            examples=("lifeos finance tree-show 11111111-1111-1111-1111-111111111111",),
        ),
    )
    tree_show.add_argument("tree_id", type=UUID)
    add_include_deleted_argument(tree_show, noun="finance trees")
    tree_show.set_defaults(handler=make_sync_handler(handle_finance_tree_show_async))

    ensure_default = add_documented_parser(
        finance_subparsers,
        "tree-ensure-default",
        help_content=HelpContent(
            summary="Ensure a preset finance tree exists.",
            description="Create the default balance or cashflow tree if it does not exist.",
            examples=("lifeos finance tree-ensure-default --purpose balance",),
        ),
    )
    ensure_default.add_argument(
        "--purpose", required=True, choices=("balance", "cashflow", "custom")
    )
    ensure_default.add_argument("--primary-currency", default="USD")
    ensure_default.set_defaults(handler=make_sync_handler(handle_finance_tree_ensure_default_async))

    node_add = add_documented_parser(
        finance_subparsers,
        "node-add",
        help_content=HelpContent(
            summary="Add a finance tree node.",
            description=(
                "Add a node to a finance tree. Nodes with children are rolled up "
                "automatically when snapshots are saved."
            ),
            examples=(
                'lifeos finance node-add <tree-id> "Checking" --parent-id <assets-id>',
                'lifeos finance node-add <tree-id> "Cash"',
            ),
        ),
    )
    node_add.add_argument("tree_id", type=UUID)
    node_add.add_argument("name")
    node_add.add_argument("--parent-id", type=UUID)
    node_add.add_argument("--currency-code")
    node_add.add_argument("--display-order", type=int, default=0)
    node_add.set_defaults(handler=make_sync_handler(handle_finance_node_add_async))

    node_update = add_documented_parser(
        finance_subparsers,
        "node-update",
        help_content=HelpContent(
            summary="Update a finance node.",
            description="Update mutable node fields without changing tree membership.",
            examples=('lifeos finance node-update <node-id> --name "Brokerage"',),
        ),
    )
    node_update.add_argument("node_id", type=UUID)
    node_update.add_argument("--name")
    node_update.add_argument("--currency-code")
    node_update.add_argument("--display-order", type=int)
    node_update.set_defaults(handler=make_sync_handler(handle_finance_node_update_async))

    node_delete = add_documented_parser(
        finance_subparsers,
        "node-delete",
        help_content=HelpContent(
            summary="Delete a finance node.",
            description="Soft-delete a finance node.",
            examples=("lifeos finance node-delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    node_delete.add_argument("node_id", type=UUID)
    node_delete.set_defaults(handler=make_sync_handler(handle_finance_node_delete_async))

    snapshot_add = add_documented_parser(
        finance_subparsers,
        "snapshot-add",
        help_content=HelpContent(
            summary="Create a finance snapshot.",
            description=(
                "Create an instant or period snapshot. Repeat --entry with "
                "node-id:amount[:currency[:amount-converted]]."
            ),
            examples=(
                "lifeos finance snapshot-add <tree-id> --entry <node-id>:1000:USD",
                "lifeos finance snapshot-add <tree-id> --period-start 2026-06-01T00:00:00 "
                "--period-end 2026-06-30T23:59:59 --entry <node-id>:-120:USD",
            ),
        ),
    )
    snapshot_add.add_argument("tree_id", type=UUID)
    snapshot_add.add_argument("--snapshot-ts", type=parse_user_datetime_value)
    snapshot_add.add_argument("--period-start", type=parse_user_datetime_value)
    snapshot_add.add_argument("--period-end", type=parse_user_datetime_value)
    snapshot_add.add_argument("--primary-currency")
    snapshot_add.add_argument("--note")
    snapshot_add.add_argument(
        "--entry",
        dest="entries",
        action="append",
        type=parse_snapshot_entry,
        required=True,
    )
    snapshot_add.set_defaults(handler=make_sync_handler(handle_finance_snapshot_add_async))

    snapshot_list = add_documented_parser(
        finance_subparsers,
        "snapshot-list",
        help_content=HelpContent(
            summary="List finance snapshots.",
            description="List finance snapshots by tree or purpose.",
            examples=(
                "lifeos finance snapshot-list --purpose balance",
                "lifeos finance snapshot-list --tree-id <tree-id>",
            ),
        ),
    )
    snapshot_list.add_argument("--tree-id", type=UUID)
    snapshot_list.add_argument("--purpose", choices=("balance", "cashflow", "custom"))
    add_limit_offset_arguments(snapshot_list)
    snapshot_list.set_defaults(handler=make_sync_handler(handle_finance_snapshot_list_async))

    snapshot_show = add_documented_parser(
        finance_subparsers,
        "snapshot-show",
        help_content=HelpContent(
            summary="Show a finance snapshot.",
            description="Show one finance snapshot with all entry amounts.",
            examples=("lifeos finance snapshot-show 11111111-1111-1111-1111-111111111111",),
        ),
    )
    snapshot_show.add_argument("snapshot_id", type=UUID)
    add_include_deleted_argument(snapshot_show, noun="finance snapshots")
    snapshot_show.set_defaults(handler=make_sync_handler(handle_finance_snapshot_show_async))
