from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from lifeos_cli.db.base import Base
from lifeos_cli.db.services import finance


async def _create_sqlite_session_factory() -> tuple[
    AsyncEngine,
    async_sessionmaker[AsyncSession],
]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False, future=True)


def test_finance_default_tree_and_snapshot_rollups() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="balance",
                    primary_currency="USD",
                )
                nodes = await finance.list_finance_nodes(session, tree_id=tree.id)
                assert {node.name for node in nodes} == {"Assets", "Liabilities"}
                assets = next(node for node in nodes if node.name == "Assets")
                checking = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="Checking",
                    currency_code="USD",
                )
                snapshot = await finance.create_finance_snapshot(
                    session,
                    tree_id=tree.id,
                    entries=[
                        finance.FinanceSnapshotEntryInput(
                            node_id=checking.id,
                            amount=Decimal("1250.50"),
                            currency_code="USD",
                        )
                    ],
                )

                assert snapshot.total_positive == Decimal("1250.50000000")
                assert snapshot.total_negative == Decimal("0E-8")
                assert snapshot.net_amount == Decimal("1250.50000000")
                assert any(
                    entry.node_id == assets.id
                    and entry.is_auto_generated
                    and entry.amount_converted == Decimal("1250.50000000")
                    for entry in snapshot.entries
                )
                await session.commit()

            async with session_factory() as session:
                trees = await finance.list_finance_trees(session, purpose="balance")
                assert len(trees) == 1
                assert trees[0].time_mode == "instant"
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_cashflow_default_tree_uses_period_time_mode() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="cashflow",
                    primary_currency="USD",
                )
                nodes = await finance.list_finance_nodes(session, tree_id=tree.id)

                assert tree.time_mode == "period"
                assert {node.name for node in nodes} == {"Inflows", "Outflows"}
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_uses_latest_rate_snapshot_for_non_primary_currency() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="balance",
                    primary_currency="USD",
                )
                assets = next(
                    node
                    for node in await finance.list_finance_nodes(session, tree_id=tree.id)
                    if node.name == "Assets"
                )
                account = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="Euro account",
                    currency_code="EUR",
                )
                rate_snapshot = await finance.create_finance_rate_snapshot(
                    session,
                    primary_currency="USD",
                    captured_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="EUR",
                            quote_currency="USD",
                            rate=Decimal("1.10"),
                        )
                    ],
                )

                snapshot = await finance.create_finance_snapshot(
                    session,
                    tree_id=tree.id,
                    snapshot_ts=datetime(2026, 6, 2, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceSnapshotEntryInput(
                            node_id=account.id,
                            amount=Decimal("10"),
                            currency_code="EUR",
                        )
                    ],
                )

                assert snapshot.rate_snapshot_id == rate_snapshot.id
                assert snapshot.rate_snapshot_policy == "latest_before_snapshot"
                assert snapshot.net_amount == Decimal("11.00000000")
                assert snapshot.exchange_rates is not None
                assert snapshot.exchange_rates["rates"]["EUR"]["rate"] == "1.100000000000"
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_supports_explicit_inverse_rate_snapshot() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="balance",
                    primary_currency="USD",
                )
                assets = next(
                    node
                    for node in await finance.list_finance_nodes(session, tree_id=tree.id)
                    if node.name == "Assets"
                )
                account = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="Euro account",
                    currency_code="EUR",
                )
                rate_snapshot = await finance.create_finance_rate_snapshot(
                    session,
                    primary_currency="USD",
                    captured_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="USD",
                            quote_currency="EUR",
                            rate=Decimal("0.8"),
                        )
                    ],
                )

                snapshot = await finance.create_finance_snapshot(
                    session,
                    tree_id=tree.id,
                    rate_snapshot_id=rate_snapshot.id,
                    entries=[
                        finance.FinanceSnapshotEntryInput(
                            node_id=account.id,
                            amount=Decimal("8"),
                            currency_code="EUR",
                        )
                    ],
                )

                assert snapshot.rate_snapshot_policy == "selected"
                assert snapshot.net_amount == Decimal("10.00000000")
                assert snapshot.exchange_rates is not None
                assert snapshot.exchange_rates["rates"]["EUR"]["derived"] is True
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_rejects_non_primary_currency_without_rate_snapshot() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="balance",
                    primary_currency="USD",
                )
                assets = next(
                    node
                    for node in await finance.list_finance_nodes(session, tree_id=tree.id)
                    if node.name == "Assets"
                )
                account = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="Euro account",
                    currency_code="EUR",
                )

                try:
                    await finance.create_finance_snapshot(
                        session,
                        tree_id=tree.id,
                        entries=[
                            finance.FinanceSnapshotEntryInput(
                                node_id=account.id,
                                amount=Decimal("10"),
                                currency_code="EUR",
                            )
                        ],
                    )
                except finance.FinanceValidationError as exc:
                    assert "rate snapshot" in str(exc)
                else:
                    raise AssertionError("non-primary currency should require a rate snapshot")
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_tree_count_matches_filters() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                await finance.ensure_default_finance_tree(
                    session,
                    purpose="balance",
                    primary_currency="USD",
                )
                custom_tree = await finance.create_finance_tree(
                    session,
                    name="Planning",
                    purpose="custom",
                    primary_currency="USD",
                )
                custom_tree.soft_delete()

                assert await finance.count_finance_trees(session) == 1
                assert await finance.count_finance_trees(session, purpose="balance") == 1
                assert await finance.count_finance_trees(session, purpose="custom") == 0
                assert (
                    await finance.count_finance_trees(
                        session,
                        purpose="custom",
                        include_deleted=True,
                    )
                    == 1
                )
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_node_delete_soft_deletes_descendants() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="balance",
                    primary_currency="USD",
                )
                nodes = await finance.list_finance_nodes(session, tree_id=tree.id)
                assets = next(node for node in nodes if node.name == "Assets")
                bank = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="Bank",
                )
                checking = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=bank.id,
                    name="Checking",
                )

                await finance.delete_finance_node(session, node_id=bank.id)
                remaining = await finance.list_finance_nodes(session, tree_id=tree.id)

                assert {node.id for node in remaining}.isdisjoint({bank.id, checking.id})
                assert next(node for node in remaining if node.id == assets.id).children_count == 0
        finally:
            await engine.dispose()

    asyncio.run(run())
