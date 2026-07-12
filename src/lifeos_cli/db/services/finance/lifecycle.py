"""Finance cross-domain lifecycle services."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.base import utc_now
from lifeos_cli.db.models.finance import (
    FinanceRateSnapshot,
    FinanceSnapshot,
)

from . import rates, snapshots, trees
from ._core import (
    FinanceRateSnapshotEntryInput,
    FinanceRateSnapshotNotFoundError,
    FinanceSnapshotEntryInput,
    FinanceTreeNotFoundError,
    FinanceValidationError,
    _finance_snapshot_entries_loader,
    _finance_snapshot_tree_loader,
)


async def update_finance_rate_snapshot(
    session: AsyncSession,
    *,
    rate_snapshot_id: UUID,
    captured_at: datetime | None = None,
    source: str | None = None,
    note: str | None = None,
    entries: list[FinanceRateSnapshotEntryInput] | None = None,
    metadata: dict[str, Any] | None = None,
    update_captured_at: bool = False,
    update_source: bool = False,
    update_note: bool = False,
    update_entries: bool = False,
    update_metadata: bool = False,
) -> FinanceRateSnapshot:
    """Update one exchange-rate snapshot and optionally replace its entries."""
    rate_snapshot = await rates.get_finance_rate_snapshot(
        session,
        rate_snapshot_id=rate_snapshot_id,
    )
    if rate_snapshot is None:
        raise FinanceRateSnapshotNotFoundError(
            f"Finance rate snapshot {rate_snapshot_id} was not found"
        )

    if update_captured_at:
        rate_snapshot.captured_at = captured_at or utc_now()
    if update_source:
        rate_snapshot.source = rates._rate_snapshot_source(source)
    if update_note:
        rate_snapshot.note = note
    if update_metadata:
        rate_snapshot.metadata_json = metadata

    if update_entries:
        if entries is None or not entries:
            raise FinanceValidationError("Finance rate snapshot requires at least one rate entry")
        for entry in rate_snapshot.entries:
            if entry.deleted_at is None:
                entry.soft_delete()
        await session.flush()
        await rates._create_finance_rate_snapshot_entries(
            session,
            rate_snapshot=rate_snapshot,
            entries=entries,
        )

    await session.flush()
    session.expire(rate_snapshot, ["entries"])
    reloaded = await rates.get_finance_rate_snapshot(session, rate_snapshot_id=rate_snapshot.id)
    resolved_rate_snapshot = reloaded or rate_snapshot
    await _recalculate_finance_snapshots_for_rate_snapshot(
        session,
        rate_snapshot=resolved_rate_snapshot,
    )
    refreshed = await rates.get_finance_rate_snapshot(session, rate_snapshot_id=rate_snapshot.id)
    return refreshed or resolved_rate_snapshot


async def delete_finance_rate_snapshot(
    session: AsyncSession,
    *,
    rate_snapshot_id: UUID,
) -> None:
    """Soft-delete an exchange-rate snapshot and its entries."""
    rate_snapshot = await rates.get_finance_rate_snapshot(
        session,
        rate_snapshot_id=rate_snapshot_id,
    )
    if rate_snapshot is None:
        raise FinanceRateSnapshotNotFoundError(
            f"Finance rate snapshot {rate_snapshot_id} was not found"
        )
    await _recalculate_finance_snapshots_for_rate_snapshot(
        session,
        rate_snapshot=rate_snapshot,
        clear_rate_snapshot=True,
    )
    for entry in rate_snapshot.entries:
        if entry.deleted_at is None:
            entry.soft_delete()
    rate_snapshot.soft_delete()
    await session.flush()


def _manual_snapshot_entry_inputs(snapshot: FinanceSnapshot) -> list[FinanceSnapshotEntryInput]:
    return [
        FinanceSnapshotEntryInput(
            node_id=entry.node_id,
            amount=entry.amount,
            currency_code=entry.currency_code,
            note=entry.note,
        )
        for entry in sorted(snapshot.entries, key=lambda item: item.created_at)
        if entry.deleted_at is None and not entry.is_auto_generated
    ]


async def _recalculate_finance_snapshots_for_rate_snapshot(
    session: AsyncSession,
    *,
    rate_snapshot: FinanceRateSnapshot,
    clear_rate_snapshot: bool = False,
) -> None:
    """Recompute snapshots that are linked to a changed exchange-rate snapshot."""
    stmt = (
        select(FinanceSnapshot)
        .options(
            _finance_snapshot_entries_loader(),
            _finance_snapshot_tree_loader(),
        )
        .where(
            FinanceSnapshot.rate_snapshot_id == rate_snapshot.id,
            FinanceSnapshot.deleted_at.is_(None),
        )
        .order_by(FinanceSnapshot.created_at.asc())
    )
    snapshot_models = list((await session.execute(stmt)).scalars())
    for snapshot in snapshot_models:
        tree = snapshot.tree or await trees.get_finance_tree(session, tree_id=snapshot.tree_id)
        if tree is None:
            raise FinanceTreeNotFoundError(f"Finance tree {snapshot.tree_id} was not found")
        if clear_rate_snapshot:
            snapshot.rate_snapshot_id = None
            snapshot.rate_snapshot_policy = "none"
            selected_rate_snapshot = None
        else:
            snapshot.rate_snapshot_id = rate_snapshot.id
            snapshot.rate_snapshot_policy = "selected"
            selected_rate_snapshot = rate_snapshot
        await snapshots._rebuild_finance_snapshot_entries(
            session,
            snapshot=snapshot,
            tree=tree,
            entries=_manual_snapshot_entry_inputs(snapshot),
            rate_snapshot=selected_rate_snapshot,
        )
