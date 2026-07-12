"""Finance snapshot services."""

from __future__ import annotations

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.base import utc_now
from lifeos_cli.db.models.finance import (
    FinanceAsset,
    FinanceRateSnapshot,
    FinanceSnapshot,
    FinanceSnapshotEntry,
    FinanceTree,
    FinanceTreeNode,
)

from . import rates, trees
from ._core import (
    DEFAULT_FINANCE_ASSET_DECIMAL_PLACES,
    FINANCE_AMOUNT_QUANT,
    FinanceRateSnapshotNotFoundError,
    FinanceSnapshotEntryInput,
    FinanceTreeNodeNotFoundError,
    FinanceTreeNotFoundError,
    FinanceValidationError,
    RateResolution,
    _decimal,
    _finance_snapshot_entries_loader,
    _finance_snapshot_rate_loader,
    _finance_snapshot_tree_loader,
    decimal_quant_for_places,
    normalize_currency_code,
    validate_asset_decimal_places,
    validate_snapshot_title,
)


def _validate_snapshot_time_fields(
    *,
    snapshot_ts: datetime | None,
    period_start: datetime | None,
    period_end: datetime | None,
) -> tuple[datetime | None, datetime | None, datetime | None]:
    has_period_start = period_start is not None
    has_period_end = period_end is not None
    if has_period_start or has_period_end:
        if period_start is None or period_end is None:
            raise FinanceValidationError(
                "Period finance snapshots require period_start and period_end"
            )
        if period_end < period_start:
            raise FinanceValidationError("Finance snapshot period_end must be after period_start")
        return snapshot_ts or utc_now(), period_start, period_end
    return snapshot_ts or utc_now(), None, None


async def _load_entry_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
    entries: list[FinanceSnapshotEntryInput],
) -> dict[UUID, FinanceTreeNode]:
    if not entries:
        raise FinanceValidationError("Finance snapshot requires at least one entry")
    node_ids = [entry.node_id for entry in entries]
    stmt = select(FinanceTreeNode).where(
        FinanceTreeNode.id.in_(set(node_ids)),
        FinanceTreeNode.tree_id == tree_id,
        FinanceTreeNode.deleted_at.is_(None),
    )
    nodes = {node.id: node for node in (await session.execute(stmt)).scalars()}
    missing = sorted(str(node_id) for node_id in set(node_ids) - set(nodes))
    if missing:
        raise FinanceTreeNodeNotFoundError(f"Finance nodes were not found: {', '.join(missing)}")
    return nodes


async def _load_rollup_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
) -> list[FinanceTreeNode]:
    stmt = (
        select(FinanceTreeNode)
        .where(
            FinanceTreeNode.tree_id == tree_id,
            FinanceTreeNode.children_count > 0,
            FinanceTreeNode.deleted_at.is_(None),
        )
        .order_by(FinanceTreeNode.depth.desc())
    )
    return list((await session.execute(stmt)).scalars())


def _quantize_amount(value: Decimal) -> Decimal:
    return value.quantize(FINANCE_AMOUNT_QUANT, rounding=ROUND_HALF_UP)


def _validate_amount_precision(
    value: Decimal,
    *,
    currency_code: str,
    decimal_places: int,
) -> Decimal:
    quantum = decimal_quant_for_places(decimal_places)
    quantized = value.quantize(quantum, rounding=ROUND_HALF_UP)
    if value != quantized:
        raise FinanceValidationError(
            f"Finance amount for {currency_code} supports at most {decimal_places} decimal places"
        )
    return quantized


async def _load_asset_decimal_places(
    session: AsyncSession,
    *,
    currency_codes: set[str],
) -> dict[str, int]:
    if not currency_codes:
        return {}
    stmt = select(FinanceAsset).where(
        FinanceAsset.code.in_(currency_codes),
        FinanceAsset.deleted_at.is_(None),
    )
    return {
        asset.code: validate_asset_decimal_places(asset.decimal_places)
        for asset in (await session.execute(stmt)).scalars()
    }


async def _select_rate_snapshot_for_entries(
    session: AsyncSession,
    *,
    explicit_rate_snapshot_id: UUID | None,
) -> tuple[FinanceRateSnapshot | None, str]:
    if explicit_rate_snapshot_id is not None:
        rate_snapshot = await rates.get_finance_rate_snapshot(
            session,
            rate_snapshot_id=explicit_rate_snapshot_id,
        )
        if rate_snapshot is None:
            raise FinanceRateSnapshotNotFoundError(
                f"Finance rate snapshot {explicit_rate_snapshot_id} was not found"
            )
        return rate_snapshot, "selected"
    return None, "none"


def _build_currency_totals(entries: list[FinanceSnapshotEntry]) -> dict[str, dict[str, Decimal]]:
    totals: dict[str, dict[str, Decimal]] = {}
    for entry in entries:
        if entry.is_auto_generated:
            continue
        currency_totals = totals.setdefault(
            entry.currency_code,
            {
                "total_positive": Decimal("0"),
                "total_negative": Decimal("0"),
                "net_amount": Decimal("0"),
            },
        )
        if entry.amount > 0:
            currency_totals["total_positive"] += entry.amount
        if entry.amount < 0:
            currency_totals["total_negative"] += entry.amount
        currency_totals["net_amount"] += entry.amount
    return totals


def _build_summary(
    entries: list[FinanceSnapshotEntry],
    *,
    primary_currency: str,
    rate_snapshot: FinanceRateSnapshot | None,
    aggregation_mode: str,
    missing_rate_currencies: set[str],
) -> dict[str, Any]:
    manual_entries = [entry for entry in entries if not entry.is_auto_generated]
    totals_by_currency = _build_currency_totals(manual_entries)
    total_source_entries = (
        manual_entries
        if aggregation_mode == "converted"
        else [entry for entry in manual_entries if entry.currency_code == primary_currency]
    )
    total_positive = sum(
        (entry.amount_converted for entry in total_source_entries if entry.amount_converted > 0),
        Decimal("0"),
    )
    total_negative = sum(
        (entry.amount_converted for entry in total_source_entries if entry.amount_converted < 0),
        Decimal("0"),
    )
    total_positive = _quantize_amount(total_positive)
    total_negative = _quantize_amount(total_negative)
    net_amount = _quantize_amount(total_positive + total_negative)
    return {
        "manual_entry_count": str(len(manual_entries)),
        "entry_count": str(len(entries)),
        "total_positive": str(total_positive),
        "total_negative": str(total_negative),
        "net_amount": str(net_amount),
        "primary_currency": primary_currency,
        "rate_snapshot_id": str(rate_snapshot.id) if rate_snapshot is not None else None,
        "aggregation_mode": aggregation_mode,
        "missing_rate_currencies": sorted(missing_rate_currencies),
        "amounts_by_currency": {
            currency: {
                key: str(_quantize_amount(value)) for key, value in sorted(currency_totals.items())
            }
            for currency, currency_totals in sorted(totals_by_currency.items())
        },
    }


async def _rebuild_finance_snapshot_entries(
    session: AsyncSession,
    *,
    snapshot: FinanceSnapshot,
    tree: FinanceTree,
    entries: list[FinanceSnapshotEntryInput],
    rate_snapshot: FinanceRateSnapshot | None,
) -> FinanceSnapshot:
    """Replace snapshot entries and recompute derived snapshot totals."""
    existing_entries = list(
        (
            await session.execute(
                select(FinanceSnapshotEntry).where(
                    FinanceSnapshotEntry.snapshot_id == snapshot.id,
                    FinanceSnapshotEntry.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    for existing_entry in existing_entries:
        await session.delete(existing_entry)
    await session.flush()

    entry_nodes = await _load_entry_nodes(session, tree_id=tree.id, entries=entries)
    normalized_inputs: list[tuple[FinanceSnapshotEntryInput, FinanceTreeNode, Decimal, str]] = []
    entry_currency_codes: set[str] = {snapshot.primary_currency}
    for entry_input in entries:
        node = entry_nodes[entry_input.node_id]
        currency_code = normalize_currency_code(
            entry_input.currency_code,
            fallback=node.currency_code or snapshot.primary_currency,
        )
        amount = _decimal(entry_input.amount)
        normalized_inputs.append((entry_input, node, amount, currency_code))
        entry_currency_codes.add(currency_code)
    seen_entry_keys: set[tuple[UUID, str]] = set()
    for _, node, _, currency_code in normalized_inputs:
        entry_key = (node.id, currency_code)
        if entry_key in seen_entry_keys:
            raise FinanceValidationError(
                f"Finance snapshot entries must reference unique assets per node: "
                f"{node.name} {currency_code}"
            )
        seen_entry_keys.add(entry_key)
    decimal_places_by_code = await _load_asset_decimal_places(
        session,
        currency_codes=entry_currency_codes,
    )
    snapshot_entries: list[FinanceSnapshotEntry] = []
    manual_entries_by_node_id: dict[UUID, list[FinanceSnapshotEntry]] = {}
    used_rates: dict[str, RateResolution] = {}
    missing_rate_currencies: set[str] = set()
    for entry_input, node, amount, currency_code in normalized_inputs:
        amount = _validate_amount_precision(
            amount,
            currency_code=currency_code,
            decimal_places=decimal_places_by_code.get(
                currency_code,
                DEFAULT_FINANCE_ASSET_DECIMAL_PLACES,
            ),
        )
        if rate_snapshot is not None:
            rate_match = rates._find_rate(
                rate_snapshot,
                base_currency=currency_code,
                quote_currency=snapshot.primary_currency,
            )
            if rate_match is None:
                rate = Decimal("1")
                if currency_code != snapshot.primary_currency:
                    missing_rate_currencies.add(currency_code)
            else:
                rate = rate_match.rate
                if currency_code != snapshot.primary_currency:
                    used_rates[currency_code] = rate_match
        else:
            rate = Decimal("1")
        amount_converted = _quantize_amount(amount * rate)
        entry = FinanceSnapshotEntry(
            snapshot_id=snapshot.id,
            node_id=node.id,
            amount=amount,
            currency_code=currency_code,
            amount_converted=amount_converted,
            note=entry_input.note,
            is_auto_generated=False,
        )
        session.add(entry)
        snapshot_entries.append(entry)
        manual_entries_by_node_id.setdefault(node.id, []).append(entry)

    rollup_nodes = await _load_rollup_nodes(session, tree_id=tree.id)
    all_nodes = {node.id: node for node in await trees.list_finance_nodes(session, tree_id=tree.id)}
    for rollup_node in rollup_nodes:
        descendant_entries = [
            entry
            for node_id, node_entries in manual_entries_by_node_id.items()
            for entry in node_entries
            if all_nodes.get(node_id) is not None
            and (
                all_nodes[node_id].id == rollup_node.id
                or all_nodes[node_id].path.startswith(f"{rollup_node.path}/")
            )
        ]
        if not descendant_entries:
            continue
        use_converted_rollups = rate_snapshot is not None and not missing_rate_currencies
        if not use_converted_rollups:
            entries_by_currency: dict[str, list[FinanceSnapshotEntry]] = {}
            for descendant_entry in descendant_entries:
                entries_by_currency.setdefault(
                    descendant_entry.currency_code,
                    [],
                ).append(descendant_entry)
            for rollup_currency, currency_entries in sorted(entries_by_currency.items()):
                amount = _quantize_amount(
                    sum((entry.amount for entry in currency_entries), Decimal("0"))
                )
                entry = FinanceSnapshotEntry(
                    snapshot_id=snapshot.id,
                    node_id=rollup_node.id,
                    amount=amount,
                    currency_code=rollup_currency,
                    amount_converted=amount,
                    is_auto_generated=True,
                )
                session.add(entry)
                snapshot_entries.append(entry)
            continue
        amount_converted = _quantize_amount(
            sum((entry.amount_converted for entry in descendant_entries), Decimal("0"))
        )
        entry = FinanceSnapshotEntry(
            snapshot_id=snapshot.id,
            node_id=rollup_node.id,
            amount=amount_converted,
            currency_code=snapshot.primary_currency,
            amount_converted=amount_converted,
            is_auto_generated=True,
        )
        session.add(entry)
        snapshot_entries.append(entry)

    manual_entries = [entry for entry in snapshot_entries if not entry.is_auto_generated]
    aggregation_mode = (
        "converted"
        if rate_snapshot is not None and not missing_rate_currencies
        else "native_by_currency"
    )
    total_source_entries = (
        manual_entries
        if aggregation_mode == "converted"
        else [entry for entry in manual_entries if entry.currency_code == snapshot.primary_currency]
    )
    snapshot.total_positive = _quantize_amount(
        sum(
            (
                entry.amount_converted
                for entry in total_source_entries
                if entry.amount_converted > 0
            ),
            Decimal("0"),
        )
    )
    snapshot.total_negative = _quantize_amount(
        sum(
            (
                entry.amount_converted
                for entry in total_source_entries
                if entry.amount_converted < 0
            ),
            Decimal("0"),
        )
    )
    snapshot.net_amount = _quantize_amount(snapshot.total_positive + snapshot.total_negative)
    snapshot.exchange_rates = rates._rate_usage_payload(
        primary_currency=snapshot.primary_currency,
        rate_snapshot=rate_snapshot,
        used_rates=used_rates,
    )
    snapshot.summary = _build_summary(
        snapshot_entries,
        primary_currency=snapshot.primary_currency,
        rate_snapshot=rate_snapshot,
        aggregation_mode=aggregation_mode,
        missing_rate_currencies=missing_rate_currencies,
    )
    await session.flush()
    await session.refresh(snapshot)
    return await get_finance_snapshot(session, snapshot_id=snapshot.id) or snapshot


async def create_finance_snapshot(
    session: AsyncSession,
    *,
    tree_id: UUID,
    entries: list[FinanceSnapshotEntryInput],
    title: str | None = None,
    snapshot_ts: datetime | None = None,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    primary_currency: str | None = None,
    rate_snapshot_id: UUID | None = None,
    note: str | None = None,
) -> FinanceSnapshot:
    """Create a finance snapshot and roll up aggregate nodes."""
    tree = await trees.get_finance_tree(session, tree_id=tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {tree_id} was not found")
    resolved_snapshot_ts, resolved_period_start, resolved_period_end = (
        _validate_snapshot_time_fields(
            snapshot_ts=snapshot_ts,
            period_start=period_start,
            period_end=period_end,
        )
    )
    resolved_currency = normalize_currency_code(primary_currency, fallback=tree.primary_currency)
    rate_snapshot, rate_snapshot_policy = await _select_rate_snapshot_for_entries(
        session,
        explicit_rate_snapshot_id=rate_snapshot_id,
    )
    snapshot = FinanceSnapshot(
        tree_id=tree_id,
        rate_snapshot_id=rate_snapshot.id if rate_snapshot is not None else None,
        title=validate_snapshot_title(title),
        snapshot_ts=resolved_snapshot_ts,
        period_start=resolved_period_start,
        period_end=resolved_period_end,
        primary_currency=resolved_currency,
        rate_snapshot_policy=rate_snapshot_policy,
        total_positive=Decimal("0"),
        total_negative=Decimal("0"),
        net_amount=Decimal("0"),
        exchange_rates=None,
        summary={},
        note=note,
    )
    session.add(snapshot)
    await session.flush()
    return await _rebuild_finance_snapshot_entries(
        session,
        snapshot=snapshot,
        tree=tree,
        entries=entries,
        rate_snapshot=rate_snapshot,
    )


async def list_finance_snapshots(
    session: AsyncSession,
    *,
    tree_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[FinanceSnapshot]:
    """List finance snapshots."""
    stmt = (
        select(FinanceSnapshot)
        .options(_finance_snapshot_tree_loader())
        .where(FinanceSnapshot.deleted_at.is_(None))
    )
    if tree_id is not None:
        stmt = stmt.where(FinanceSnapshot.tree_id == tree_id)
    stmt = (
        stmt.order_by(
            FinanceSnapshot.snapshot_ts.desc().nullslast(),
            FinanceSnapshot.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def update_finance_snapshot(
    session: AsyncSession,
    *,
    snapshot_id: UUID,
    entries: list[FinanceSnapshotEntryInput] | None = None,
    title: str | None = None,
    snapshot_ts: datetime | None = None,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    primary_currency: str | None = None,
    rate_snapshot_id: UUID | None = None,
    note: str | None = None,
    update_title: bool = False,
    update_time_fields: bool = False,
    update_primary_currency: bool = False,
    update_rate_snapshot: bool = False,
    update_note: bool = False,
) -> FinanceSnapshot:
    """Update a finance snapshot and recompute derived amounts when needed."""
    snapshot = await get_finance_snapshot(session, snapshot_id=snapshot_id)
    if snapshot is None:
        raise FinanceTreeNotFoundError(f"Finance snapshot {snapshot_id} was not found")
    tree = snapshot.tree or await trees.get_finance_tree(session, tree_id=snapshot.tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {snapshot.tree_id} was not found")

    if update_title:
        snapshot.title = validate_snapshot_title(title)

    if update_time_fields:
        resolved_snapshot_ts, resolved_period_start, resolved_period_end = (
            _validate_snapshot_time_fields(
                snapshot_ts=snapshot_ts,
                period_start=period_start,
                period_end=period_end,
            )
        )
        snapshot.snapshot_ts = resolved_snapshot_ts
        snapshot.period_start = resolved_period_start
        snapshot.period_end = resolved_period_end

    if update_primary_currency:
        snapshot.primary_currency = normalize_currency_code(
            primary_currency,
            fallback=tree.primary_currency,
        )

    if update_note:
        snapshot.note = note

    resolved_rate_snapshot_id = (
        rate_snapshot_id if update_rate_snapshot else snapshot.rate_snapshot_id
    )
    rate_snapshot, rate_snapshot_policy = await _select_rate_snapshot_for_entries(
        session,
        explicit_rate_snapshot_id=resolved_rate_snapshot_id,
    )
    snapshot.rate_snapshot_id = rate_snapshot.id if rate_snapshot is not None else None
    snapshot.rate_snapshot_policy = rate_snapshot_policy

    rebuild_entries = entries
    if rebuild_entries is None:
        rebuild_entries = [
            FinanceSnapshotEntryInput(
                node_id=entry.node_id,
                amount=entry.amount,
                currency_code=entry.currency_code,
                note=entry.note,
            )
            for entry in snapshot.entries
            if not entry.is_auto_generated
        ]
    return await _rebuild_finance_snapshot_entries(
        session,
        snapshot=snapshot,
        tree=tree,
        entries=rebuild_entries,
        rate_snapshot=rate_snapshot,
    )


async def delete_finance_snapshot(
    session: AsyncSession,
    *,
    snapshot_id: UUID,
) -> None:
    """Soft-delete a finance snapshot and its entries."""
    snapshot = await get_finance_snapshot(session, snapshot_id=snapshot_id)
    if snapshot is None:
        raise FinanceTreeNotFoundError(f"Finance snapshot {snapshot_id} was not found")
    for entry in snapshot.entries:
        entry.soft_delete()
    snapshot.soft_delete()
    await session.flush()


async def get_finance_snapshot(
    session: AsyncSession,
    *,
    snapshot_id: UUID,
) -> FinanceSnapshot | None:
    """Load one finance snapshot with entries and node metadata."""
    stmt = (
        select(FinanceSnapshot)
        .options(
            _finance_snapshot_tree_loader(),
            _finance_snapshot_rate_loader(),
            _finance_snapshot_entries_loader(),
        )
        .where(FinanceSnapshot.id == snapshot_id)
        .limit(1)
    )
    stmt = stmt.where(FinanceSnapshot.deleted_at.is_(None))
    snapshot = (await session.execute(stmt)).scalar_one_or_none()
    if snapshot is None:
        return None
    return snapshot


async def count_finance_snapshots(
    session: AsyncSession,
    *,
    tree_id: UUID | None = None,
) -> int:
    """Count finance snapshots."""
    stmt = (
        select(func.count())
        .select_from(FinanceSnapshot)
        .where(FinanceSnapshot.deleted_at.is_(None))
    )
    if tree_id is not None:
        stmt = stmt.where(FinanceSnapshot.tree_id == tree_id)
    return int((await session.execute(stmt)).scalar_one())
