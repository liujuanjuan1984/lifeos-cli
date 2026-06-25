"""CLI handlers for the finance resource."""

from __future__ import annotations

import argparse
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from lifeos_cli.application.time_preferences import to_storage_timezone
from lifeos_cli.cli_support import handler_utils as cli_handler_utils
from lifeos_cli.cli_support.output_utils import format_timestamp, print_summary_rows
from lifeos_cli.db import session as db_session
from lifeos_cli.db.models.finance import (
    FinanceRateSnapshot,
    FinanceSnapshot,
    FinanceTree,
    FinanceTreeNode,
)
from lifeos_cli.db.services import finance as finance_services

TREE_SUMMARY_COLUMNS = ("tree_id", "purpose", "time_mode", "currency", "name")
SNAPSHOT_SUMMARY_COLUMNS = ("snapshot_id", "tree_id", "title", "period", "net_amount", "currency")
RATE_SNAPSHOT_SUMMARY_COLUMNS = ("rate_snapshot_id", "captured_at", "pairs", "source")


def _format_tree_summary(tree: FinanceTree) -> str:
    return f"{tree.id}\t{tree.purpose}\t{tree.time_mode}\t{tree.primary_currency}\t{tree.name}"


def _format_node_summary(node: FinanceTreeNode) -> str:
    indent = "  " * node.depth
    return f"{node.id}\t{node.parent_id or '-'}\t{node.currency_code or '-'}\t{indent}{node.name}"


def _format_snapshot_period(snapshot: FinanceSnapshot) -> str:
    if snapshot.period_start is not None and snapshot.period_end is not None:
        return f"{format_timestamp(snapshot.period_start)}..{format_timestamp(snapshot.period_end)}"
    return format_timestamp(snapshot.snapshot_ts)


def _format_decimal(value: Decimal) -> str:
    return format(value, "f")


def _format_snapshot_summary(snapshot: FinanceSnapshot) -> str:
    return (
        f"{snapshot.id}\t{snapshot.tree_id}\t{snapshot.title or '-'}\t"
        f"{_format_snapshot_period(snapshot)}\t"
        f"{_format_decimal(snapshot.net_amount)}\t{snapshot.primary_currency}"
    )


def _format_rate_snapshot_summary(rate_snapshot: FinanceRateSnapshot) -> str:
    pairs = ",".join(
        f"{entry.base_currency}/{entry.quote_currency}" for entry in rate_snapshot.entries[:3]
    )
    return (
        f"{rate_snapshot.id}\t{format_timestamp(rate_snapshot.captured_at)}\t"
        f"{pairs or '-'}\t{rate_snapshot.source}"
    )


def _format_tree_detail(tree: FinanceTree, nodes: list[FinanceTreeNode]) -> str:
    node_lines = [_format_node_summary(node) for node in nodes]
    return "\n".join(
        (
            f"id: {tree.id}",
            f"name: {tree.name}",
            f"purpose: {tree.purpose}",
            f"time_mode: {tree.time_mode}",
            f"primary_currency: {tree.primary_currency}",
            f"is_default: {tree.is_default}",
            f"display_order: {tree.display_order}",
            f"created_at: {format_timestamp(tree.created_at)}",
            f"updated_at: {format_timestamp(tree.updated_at)}",
            "nodes:",
            *(node_lines or ["-"]),
        )
    )


def _format_snapshot_detail(snapshot: FinanceSnapshot) -> str:
    entry_lines = [
        (
            f"  {entry.node_id}\t{entry.node.name if entry.node else '-'}\t"
            f"{_format_decimal(entry.amount)}\t{entry.currency_code}\t"
            f"{_format_decimal(entry.amount_converted)}\t"
            f"{'auto' if entry.is_auto_generated else 'manual'}"
        )
        for entry in snapshot.entries
    ]
    return "\n".join(
        (
            f"id: {snapshot.id}",
            f"tree_id: {snapshot.tree_id}",
            f"title: {snapshot.title or '-'}",
            f"snapshot_ts: {format_timestamp(snapshot.snapshot_ts)}",
            f"period_start: {format_timestamp(snapshot.period_start)}",
            f"period_end: {format_timestamp(snapshot.period_end)}",
            f"primary_currency: {snapshot.primary_currency}",
            f"rate_snapshot_id: {snapshot.rate_snapshot_id or '-'}",
            f"rate_snapshot_policy: {snapshot.rate_snapshot_policy}",
            f"total_positive: {_format_decimal(snapshot.total_positive)}",
            f"total_negative: {_format_decimal(snapshot.total_negative)}",
            f"net_amount: {_format_decimal(snapshot.net_amount)}",
            f"note: {snapshot.note or '-'}",
            "entries:",
            "  node_id\tname\tamount\tcurrency\tconverted\tsource",
            *(entry_lines or ["  -"]),
        )
    )


def _format_rate_snapshot_detail(rate_snapshot: FinanceRateSnapshot) -> str:
    entry_lines = [
        (
            f"  {entry.base_currency}\t{entry.quote_currency}\t{entry.rate}\t"
            f"{entry.source or '-'}\t{format_timestamp(entry.captured_at)}"
        )
        for entry in rate_snapshot.entries
    ]
    return "\n".join(
        (
            f"id: {rate_snapshot.id}",
            f"captured_at: {format_timestamp(rate_snapshot.captured_at)}",
            f"source: {rate_snapshot.source}",
            f"note: {rate_snapshot.note or '-'}",
            "entries:",
            "  base_currency\tquote_currency\trate\tsource\tcaptured_at",
            *(entry_lines or ["  -"]),
        )
    )


def parse_snapshot_entry(value: str) -> finance_services.FinanceSnapshotEntryInput:
    """Parse node_id:amount[:currency] CLI entry syntax."""
    parts = value.split(":")
    if len(parts) not in {2, 3}:
        raise argparse.ArgumentTypeError("Entry must use node-id:amount[:currency]")
    node_id_text, amount_text = parts[0], parts[1]
    currency_code = parts[2] if len(parts) >= 3 and parts[2] else None
    try:
        return finance_services.FinanceSnapshotEntryInput(
            node_id=UUID(node_id_text),
            amount=Decimal(amount_text),
            currency_code=currency_code,
        )
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def parse_rate_snapshot_entry(value: str) -> finance_services.FinanceRateSnapshotEntryInput:
    """Parse base-currency:rate:quote-currency CLI rate syntax."""
    parts = value.split(":")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("Rate must use base-currency:rate:quote-currency")
    base_currency, rate_text = parts[0], parts[1]
    quote_currency = parts[2]
    try:
        return finance_services.FinanceRateSnapshotEntryInput(
            base_currency=base_currency,
            rate=Decimal(rate_text),
            quote_currency=quote_currency,
        )
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _storage_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return to_storage_timezone(value)


async def handle_finance_tree_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            tree = await finance_services.create_finance_tree(
                session,
                name=args.name,
                purpose=args.purpose,
                time_mode=args.time_mode,
                primary_currency=args.primary_currency,
                display_order=args.display_order,
                is_default=args.default,
            )
        except ValueError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Created finance tree {tree.id}")
    return 0


async def handle_finance_tree_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            trees = await finance_services.list_finance_trees(
                session,
                purpose=args.purpose,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except ValueError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print_summary_rows(
        items=trees,
        columns=TREE_SUMMARY_COLUMNS,
        row_formatter=_format_tree_summary,
        empty_message="No finance trees found.",
    )
    return 0


async def handle_finance_tree_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        tree = await finance_services.get_finance_tree_with_nodes(
            session,
            tree_id=args.tree_id,
            include_deleted=args.include_deleted,
        )
    if tree is None:
        return cli_handler_utils.print_missing_record_error("Finance tree", args.tree_id)
    print(_format_tree_detail(tree, list(tree.nodes)))
    return 0


async def handle_finance_tree_ensure_default_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            tree = await finance_services.ensure_default_finance_tree(
                session,
                purpose=args.purpose,
                primary_currency=args.primary_currency,
            )
        except ValueError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Default finance tree {tree.id}")
    return 0


async def handle_finance_node_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            node = await finance_services.create_finance_node(
                session,
                tree_id=args.tree_id,
                parent_id=args.parent_id,
                name=args.name,
                currency_code=args.currency_code,
                display_order=args.display_order,
            )
        except (LookupError, ValueError) as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Created finance node {node.id}")
    return 0


async def handle_finance_node_update_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            node = await finance_services.update_finance_node(
                session,
                node_id=args.node_id,
                name=args.name,
                currency_code=args.currency_code,
                display_order=args.display_order,
            )
        except (LookupError, ValueError) as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Updated finance node {node.id}")
    return 0


async def handle_finance_node_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await finance_services.delete_finance_node(session, node_id=args.node_id)
        except LookupError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Soft-deleted finance node {args.node_id}")
    return 0


async def handle_finance_snapshot_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            snapshot = await finance_services.create_finance_snapshot(
                session,
                tree_id=args.tree_id,
                title=args.title,
                snapshot_ts=_storage_datetime(args.snapshot_ts),
                period_start=_storage_datetime(args.period_start),
                period_end=_storage_datetime(args.period_end),
                primary_currency=args.primary_currency,
                rate_snapshot_id=args.rate_snapshot_id,
                note=args.note,
                entries=list(args.entries),
            )
        except (LookupError, ValueError) as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Created finance snapshot {snapshot.id}")
    return 0


async def handle_finance_rate_snapshot_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            rate_snapshot = await finance_services.create_finance_rate_snapshot(
                session,
                captured_at=_storage_datetime(args.captured_at),
                source=args.source,
                note=args.note,
                entries=list(args.rates),
            )
        except ValueError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print(f"Created finance rate snapshot {rate_snapshot.id}")
    return 0


async def handle_finance_rate_snapshot_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            rate_snapshots = await finance_services.list_finance_rate_snapshots(
                session,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except ValueError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print_summary_rows(
        items=rate_snapshots,
        columns=RATE_SNAPSHOT_SUMMARY_COLUMNS,
        row_formatter=_format_rate_snapshot_summary,
        empty_message="No finance rate snapshots found.",
    )
    return 0


async def handle_finance_rate_snapshot_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        rate_snapshot = await finance_services.get_finance_rate_snapshot(
            session,
            rate_snapshot_id=args.rate_snapshot_id,
            include_deleted=args.include_deleted,
        )
    if rate_snapshot is None:
        return cli_handler_utils.print_missing_record_error(
            "Finance rate snapshot",
            args.rate_snapshot_id,
        )
    print(_format_rate_snapshot_detail(rate_snapshot))
    return 0


async def handle_finance_snapshot_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            snapshots = await finance_services.list_finance_snapshots(
                session,
                tree_id=args.tree_id,
                purpose=args.purpose,
                limit=args.limit,
                offset=args.offset,
            )
        except ValueError as exc:
            return cli_handler_utils.print_cli_error(exc)
    print_summary_rows(
        items=snapshots,
        columns=SNAPSHOT_SUMMARY_COLUMNS,
        row_formatter=_format_snapshot_summary,
        empty_message="No finance snapshots found.",
    )
    return 0


async def handle_finance_snapshot_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        snapshot = await finance_services.get_finance_snapshot(
            session,
            snapshot_id=args.snapshot_id,
            include_deleted=args.include_deleted,
        )
    if snapshot is None:
        return cli_handler_utils.print_missing_record_error("Finance snapshot", args.snapshot_id)
    print(_format_snapshot_detail(snapshot))
    return 0
