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


def test_finance_assets_include_defaults_and_custom_assets() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                assets = await finance.list_finance_assets(session)
                assert {"USD", "USDT", "CNY", "BTC"}.issubset({asset.code for asset in assets})

                custom = await finance.create_finance_asset(
                    session,
                    code="sol",
                    name="Solana",
                )
                assert custom.code == "SOL"

                updated = await finance.update_finance_asset(
                    session,
                    asset_id=custom.id,
                    name="Solana token",
                )
                assert updated.name == "Solana token"

                await finance.delete_finance_asset(session, asset_id=custom.id)
                assert all(
                    asset.code != "SOL" for asset in await finance.list_finance_assets(session)
                )

                usd = next(
                    asset
                    for asset in await finance.list_finance_assets(session)
                    if asset.code == "USD"
                )
                await finance.delete_finance_asset(session, asset_id=usd.id)
                active_assets = await finance.list_finance_assets(session)
                assert all(asset.code != "USD" for asset in active_assets)
                deleted_assets = await finance.list_finance_assets(session, include_deleted=True)
                assert any(
                    asset.code == "USD" and asset.deleted_at is not None for asset in deleted_assets
                )
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_without_rate_snapshot_keeps_native_currency_totals() -> None:
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

                assert snapshot.rate_snapshot_id is None
                assert snapshot.rate_snapshot_policy == "none"
                assert snapshot.net_amount == Decimal("0E-8")
                assert snapshot.exchange_rates is None
                assert snapshot.summary is not None
                assert snapshot.summary["aggregation_mode"] == "native_by_currency"
                assert snapshot.summary["amounts_by_currency"]["EUR"]["net_amount"] == "10.00000000"
                assert any(
                    entry.node_id == assets.id
                    and entry.currency_code == "EUR"
                    and entry.amount == Decimal("10.00000000")
                    for entry in snapshot.entries
                )
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


def test_finance_snapshot_uses_chained_rates_and_follows_rate_snapshot_updates() -> None:
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
                btc = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="BTC",
                    currency_code="BTC",
                )
                cny = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="CNY",
                    currency_code="CNY",
                )
                usdt = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=assets.id,
                    name="USDT",
                    currency_code="USDT",
                )
                rate_snapshot = await finance.create_finance_rate_snapshot(
                    session,
                    captured_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="BTC",
                            quote_currency="USDT",
                            rate=Decimal("64123.56"),
                        ),
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="USDT",
                            quote_currency="CNY",
                            rate=Decimal("6.6"),
                        ),
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="USDT",
                            quote_currency="USD",
                            rate=Decimal("0.98"),
                        ),
                    ],
                )

                snapshot = await finance.create_finance_snapshot(
                    session,
                    tree_id=tree.id,
                    rate_snapshot_id=rate_snapshot.id,
                    entries=[
                        finance.FinanceSnapshotEntryInput(
                            node_id=btc.id,
                            amount=Decimal("0.1"),
                            currency_code="BTC",
                        ),
                        finance.FinanceSnapshotEntryInput(
                            node_id=cny.id,
                            amount=Decimal("660"),
                            currency_code="CNY",
                        ),
                        finance.FinanceSnapshotEntryInput(
                            node_id=usdt.id,
                            amount=Decimal("100"),
                            currency_code="USDT",
                        ),
                    ],
                )

                assert snapshot.summary is not None
                assert snapshot.summary["aggregation_mode"] == "converted"
                assert snapshot.summary["missing_rate_currencies"] == []
                assert snapshot.net_amount == Decimal("6480.10888000")
                assert snapshot.exchange_rates is not None
                assert snapshot.exchange_rates["rates"]["BTC"]["path"] == [
                    "BTC",
                    "USDT",
                    "USD",
                ]
                assert snapshot.exchange_rates["rates"]["BTC"]["derived"] is True
                assert snapshot.exchange_rates["rates"]["CNY"]["path"] == [
                    "CNY",
                    "USDT",
                    "USD",
                ]
                assert snapshot.exchange_rates["rates"]["CNY"]["derived"] is True
                assert snapshot.exchange_rates["rates"]["USDT"]["path"] == ["USDT", "USD"]
                assert snapshot.exchange_rates["rates"]["USDT"]["derived"] is False

                await finance.update_finance_rate_snapshot(
                    session,
                    rate_snapshot_id=rate_snapshot.id,
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="BTC",
                            quote_currency="USDT",
                            rate=Decimal("1000"),
                        ),
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="USDT",
                            quote_currency="CNY",
                            rate=Decimal("10"),
                        ),
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="USDT",
                            quote_currency="USD",
                            rate=Decimal("2"),
                        ),
                    ],
                    update_entries=True,
                )
                recalculated = await finance.get_finance_snapshot(
                    session,
                    snapshot_id=snapshot.id,
                )
                assert recalculated is not None
                assert recalculated.net_amount == Decimal("532.00000000")
                assert recalculated.summary is not None
                assert recalculated.summary["aggregation_mode"] == "converted"

                await finance.delete_finance_rate_snapshot(
                    session,
                    rate_snapshot_id=rate_snapshot.id,
                )
                cleared = await finance.get_finance_snapshot(
                    session,
                    snapshot_id=snapshot.id,
                )
                assert cleared is not None
                assert cleared.rate_snapshot_id is None
                assert cleared.rate_snapshot_policy == "none"
                assert cleared.net_amount == Decimal("0E-8")
                assert cleared.exchange_rates is None
                assert cleared.summary is not None
                assert cleared.summary["aggregation_mode"] == "native_by_currency"
                assert cleared.summary["amounts_by_currency"]["BTC"]["net_amount"] == "0.10000000"
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_with_incomplete_rate_snapshot_keeps_native_totals() -> None:
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
                    captured_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="BTC",
                            quote_currency="USD",
                            rate=Decimal("67000"),
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

                assert snapshot.rate_snapshot_id == rate_snapshot.id
                assert snapshot.rate_snapshot_policy == "selected"
                assert snapshot.net_amount == Decimal("0E-8")
                assert snapshot.exchange_rates is None
                assert snapshot.summary is not None
                assert snapshot.summary["aggregation_mode"] == "native_by_currency"
                assert snapshot.summary["net_amount"] == "0E-8"
                assert snapshot.summary["missing_rate_currencies"] == ["EUR"]
                assert snapshot.summary["amounts_by_currency"]["EUR"]["net_amount"] == "8.00000000"
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_rate_snapshot_can_be_updated_and_deleted() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                rate_snapshot = await finance.create_finance_rate_snapshot(
                    session,
                    captured_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    source="manual",
                    note="Initial rates",
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="BTC",
                            quote_currency="USD",
                            rate=Decimal("67000"),
                        )
                    ],
                )

                updated = await finance.update_finance_rate_snapshot(
                    session,
                    rate_snapshot_id=rate_snapshot.id,
                    captured_at=datetime(2026, 6, 2, tzinfo=timezone.utc),
                    source="import",
                    note="Updated rates",
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="ETH",
                            quote_currency="USD",
                            rate=Decimal("3500"),
                        )
                    ],
                    update_captured_at=True,
                    update_source=True,
                    update_note=True,
                    update_entries=True,
                )

                assert updated.source == "import"
                assert updated.note == "Updated rates"
                assert len(updated.entries) == 1
                assert updated.entries[0].base_currency == "ETH"
                assert updated.entries[0].quote_currency == "USD"
                assert updated.entries[0].rate == Decimal("3500.000000000000")

                await finance.delete_finance_rate_snapshot(
                    session,
                    rate_snapshot_id=rate_snapshot.id,
                )

                assert (
                    await finance.get_finance_rate_snapshot(
                        session,
                        rate_snapshot_id=rate_snapshot.id,
                    )
                    is None
                )
                assert await finance.count_finance_rate_snapshots(session) == 0
                deleted = await finance.get_finance_rate_snapshot(
                    session,
                    rate_snapshot_id=rate_snapshot.id,
                    include_deleted=True,
                )
                assert deleted is not None
                assert deleted.deleted_at is not None
                assert all(entry.deleted_at is not None for entry in deleted.entries)
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_rate_snapshot_can_be_cleared() -> None:
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
                    captured_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceRateSnapshotEntryInput(
                            base_currency="EUR",
                            quote_currency="USD",
                            rate=Decimal("2"),
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
                            amount=Decimal("10"),
                            currency_code="EUR",
                        )
                    ],
                )
                assert snapshot.net_amount == Decimal("20.00000000")

                updated = await finance.update_finance_snapshot(
                    session,
                    snapshot_id=snapshot.id,
                    rate_snapshot_id=None,
                    update_rate_snapshot=True,
                )

                assert updated.rate_snapshot_id is None
                assert updated.rate_snapshot_policy == "none"
                assert updated.net_amount == Decimal("0E-8")
                assert updated.summary is not None
                assert updated.summary["amounts_by_currency"]["EUR"]["net_amount"] == "10.00000000"
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_finance_snapshot_can_be_updated_and_deleted() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tree = await finance.ensure_default_finance_tree(
                    session,
                    purpose="cashflow",
                    primary_currency="USD",
                )
                inflows = next(
                    node
                    for node in await finance.list_finance_nodes(session, tree_id=tree.id)
                    if node.name == "Inflows"
                )
                salary = await finance.create_finance_node(
                    session,
                    tree_id=tree.id,
                    parent_id=inflows.id,
                    name="Salary",
                    currency_code="USD",
                )
                snapshot = await finance.create_finance_snapshot(
                    session,
                    tree_id=tree.id,
                    period_start=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    period_end=datetime(2026, 6, 30, tzinfo=timezone.utc),
                    entries=[
                        finance.FinanceSnapshotEntryInput(
                            node_id=salary.id,
                            amount=Decimal("100"),
                            currency_code="USD",
                        )
                    ],
                )

                updated = await finance.update_finance_snapshot(
                    session,
                    snapshot_id=snapshot.id,
                    period_start=datetime(2026, 7, 1, tzinfo=timezone.utc),
                    period_end=datetime(2026, 7, 31, tzinfo=timezone.utc),
                    note="July cashflow",
                    entries=[
                        finance.FinanceSnapshotEntryInput(
                            node_id=salary.id,
                            amount=Decimal("125"),
                            currency_code="USD",
                            note="Updated salary",
                        )
                    ],
                    update_time_fields=True,
                    update_note=True,
                )

                assert updated.period_start == datetime(2026, 7, 1, tzinfo=timezone.utc)
                assert updated.period_end == datetime(2026, 7, 31, tzinfo=timezone.utc)
                assert updated.note == "July cashflow"
                assert updated.net_amount == Decimal("125.00000000")
                manual_entries = [entry for entry in updated.entries if not entry.is_auto_generated]
                assert len(manual_entries) == 1
                assert manual_entries[0].note == "Updated salary"

                await finance.delete_finance_snapshot(session, snapshot_id=snapshot.id)

                assert await finance.get_finance_snapshot(session, snapshot_id=snapshot.id) is None
                assert await finance.count_finance_snapshots(session, tree_id=tree.id) == 0
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
