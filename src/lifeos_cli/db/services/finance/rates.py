"""Finance exchange-rate services."""

from __future__ import annotations

from collections import deque
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.base import utc_now
from lifeos_cli.db.models.finance import (
    FinanceRateSnapshot,
    FinanceRateSnapshotEntry,
)

from ._core import (
    FINANCE_RATE_QUANT,
    FinanceRateSnapshotEntryInput,
    FinanceValidationError,
    RateResolution,
    _decimal,
    _finance_rate_entries_loader,
    normalize_currency_code,
)


def _format_rate(value: Decimal) -> str:
    return str(value.quantize(FINANCE_RATE_QUANT, rounding=ROUND_HALF_UP))


def _validate_rate(value: Decimal | int | str) -> Decimal:
    rate = _decimal(value)
    if rate <= 0:
        raise FinanceValidationError("Exchange rate must be greater than zero")
    return rate


def _rate_snapshot_source(source: str | None) -> str:
    resolved = (source or "manual").strip().lower()
    if not resolved:
        raise FinanceValidationError("Finance rate snapshot source must not be empty")
    if len(resolved) > 64:
        raise FinanceValidationError("Finance rate snapshot source must be 64 characters or fewer")
    return resolved


async def create_finance_rate_snapshot(
    session: AsyncSession,
    *,
    captured_at: datetime | None = None,
    source: str | None = None,
    note: str | None = None,
    entries: list[FinanceRateSnapshotEntryInput],
    metadata: dict[str, Any] | None = None,
) -> FinanceRateSnapshot:
    """Create one exchange-rate snapshot."""
    if not entries:
        raise FinanceValidationError("Finance rate snapshot requires at least one rate entry")
    resolved_captured_at = captured_at or utc_now()
    rate_snapshot = FinanceRateSnapshot(
        captured_at=resolved_captured_at,
        source=_rate_snapshot_source(source),
        note=note,
        metadata_json=metadata,
    )
    session.add(rate_snapshot)
    await session.flush()

    await _create_finance_rate_snapshot_entries(
        session,
        rate_snapshot=rate_snapshot,
        entries=entries,
    )

    await session.flush()
    await session.refresh(rate_snapshot)
    reloaded = await get_finance_rate_snapshot(session, rate_snapshot_id=rate_snapshot.id)
    return reloaded or rate_snapshot


async def _create_finance_rate_snapshot_entries(
    session: AsyncSession,
    *,
    rate_snapshot: FinanceRateSnapshot,
    entries: list[FinanceRateSnapshotEntryInput],
) -> None:
    """Add validated rate entries to one exchange-rate snapshot."""
    seen_pairs: set[tuple[str, str]] = set()
    for entry_input in entries:
        base_currency = normalize_currency_code(entry_input.base_currency)
        quote_currency = normalize_currency_code(entry_input.quote_currency)
        if base_currency == quote_currency:
            raise FinanceValidationError("Exchange-rate pair assets must be different")
        pair = (base_currency, quote_currency)
        if pair in seen_pairs:
            raise FinanceValidationError(
                f"Duplicate exchange-rate pair: {base_currency}/{quote_currency}"
            )
        seen_pairs.add(pair)
        rate_entry = FinanceRateSnapshotEntry(
            rate_snapshot_id=rate_snapshot.id,
            base_currency=base_currency,
            quote_currency=quote_currency,
            rate=_validate_rate(entry_input.rate),
            source=entry_input.source,
            captured_at=entry_input.captured_at,
            is_derived=entry_input.is_derived,
            metadata_json=entry_input.metadata,
        )
        session.add(rate_entry)


async def get_finance_rate_snapshot(
    session: AsyncSession,
    *,
    rate_snapshot_id: UUID,
) -> FinanceRateSnapshot | None:
    """Load one finance rate snapshot with entries."""
    stmt = (
        select(FinanceRateSnapshot)
        .options(_finance_rate_entries_loader())
        .where(FinanceRateSnapshot.id == rate_snapshot_id)
        .limit(1)
    )
    stmt = stmt.where(FinanceRateSnapshot.deleted_at.is_(None))
    rate_snapshot = (await session.execute(stmt)).scalar_one_or_none()
    if rate_snapshot is None:
        return None
    return rate_snapshot


async def list_finance_rate_snapshots(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[FinanceRateSnapshot]:
    """List exchange-rate snapshots."""
    stmt = select(FinanceRateSnapshot).options(_finance_rate_entries_loader())
    stmt = stmt.where(FinanceRateSnapshot.deleted_at.is_(None))
    stmt = (
        stmt.order_by(
            FinanceRateSnapshot.captured_at.desc(),
            FinanceRateSnapshot.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def count_finance_rate_snapshots(
    session: AsyncSession,
) -> int:
    """Count exchange-rate snapshots."""
    stmt = select(func.count()).select_from(FinanceRateSnapshot)
    stmt = stmt.where(FinanceRateSnapshot.deleted_at.is_(None))
    return int((await session.execute(stmt)).scalar_one())


def _active_rate_entries(rate_snapshot: FinanceRateSnapshot) -> list[FinanceRateSnapshotEntry]:
    return sorted(
        (entry for entry in rate_snapshot.entries if entry.deleted_at is None),
        key=lambda entry: (
            entry.base_currency,
            entry.quote_currency,
            entry.created_at,
            str(entry.id),
        ),
    )


def _resolve_rate(
    rate_snapshot: FinanceRateSnapshot | None,
    *,
    base_currency: str,
    quote_currency: str,
) -> RateResolution:
    base = normalize_currency_code(base_currency)
    quote = normalize_currency_code(quote_currency)
    if base == quote:
        return RateResolution(
            rate=Decimal("1"),
            derived=False,
            source_entries=(),
            path=(base,),
            source_pairs=(),
        )
    if rate_snapshot is None:
        raise FinanceValidationError(
            f"Finance snapshot requires a rate snapshot for {base}/{quote}"
        )

    graph: dict[
        str,
        list[tuple[str, Decimal, bool, FinanceRateSnapshotEntry, str]],
    ] = {}
    for entry in _active_rate_entries(rate_snapshot):
        rate = _validate_rate(entry.rate)
        entry_base = normalize_currency_code(entry.base_currency)
        entry_quote = normalize_currency_code(entry.quote_currency)
        graph.setdefault(entry_base, []).append(
            (entry_quote, rate, False, entry, f"{entry_base}/{entry_quote}")
        )
        graph.setdefault(entry_quote, []).append(
            (entry_base, Decimal("1") / rate, True, entry, f"{entry_quote}/{entry_base}")
        )

    queue: deque[
        tuple[
            str,
            Decimal,
            tuple[FinanceRateSnapshotEntry, ...],
            tuple[str, ...],
            tuple[str, ...],
            bool,
        ]
    ] = deque([(base, Decimal("1"), (), (), (base,), False)])
    visited = {base}

    while queue:
        currency, rate, source_entries, source_pairs, path, uses_inverse = queue.popleft()
        for next_currency, edge_rate, edge_inverse, source_entry, source_pair in sorted(
            graph.get(currency, []),
            key=lambda edge: (edge[2], edge[0], edge[4]),
        ):
            if next_currency in visited:
                continue
            next_rate = rate * edge_rate
            next_source_entries = source_entries + (source_entry,)
            next_source_pairs = source_pairs + (source_pair,)
            next_path = path + (next_currency,)
            next_uses_inverse = uses_inverse or edge_inverse
            if next_currency == quote:
                return RateResolution(
                    rate=next_rate,
                    derived=next_uses_inverse or len(next_source_entries) > 1,
                    source_entries=next_source_entries,
                    path=next_path,
                    source_pairs=next_source_pairs,
                )
            visited.add(next_currency)
            queue.append(
                (
                    next_currency,
                    next_rate,
                    next_source_entries,
                    next_source_pairs,
                    next_path,
                    next_uses_inverse,
                )
            )

    raise FinanceValidationError(
        f"Rate snapshot {rate_snapshot.id} does not include a path for {base}/{quote}"
    )


def _find_rate(
    rate_snapshot: FinanceRateSnapshot,
    *,
    base_currency: str,
    quote_currency: str,
) -> RateResolution | None:
    try:
        return _resolve_rate(
            rate_snapshot,
            base_currency=base_currency,
            quote_currency=quote_currency,
        )
    except FinanceValidationError:
        return None


def _rate_usage_payload(
    *,
    primary_currency: str,
    rate_snapshot: FinanceRateSnapshot | None,
    used_rates: dict[str, RateResolution],
) -> dict[str, Any] | None:
    if not used_rates:
        return None
    return {
        "primary_currency": primary_currency,
        "rate_snapshot_id": str(rate_snapshot.id) if rate_snapshot is not None else None,
        "captured_at": rate_snapshot.captured_at.isoformat() if rate_snapshot is not None else None,
        "rates": {
            currency: {
                "base_currency": currency,
                "quote_currency": primary_currency,
                "rate": _format_rate(resolution.rate),
                "derived": resolution.derived,
                "source_rate_entry_id": (
                    str(resolution.source_entries[0].id)
                    if len(resolution.source_entries) == 1
                    else None
                ),
                "source_pair": " -> ".join(resolution.source_pairs)
                if resolution.source_pairs
                else f"{currency}/{primary_currency}",
                "source_rate_entry_ids": [
                    str(source_entry.id) for source_entry in resolution.source_entries
                ],
                "source_pairs": list(resolution.source_pairs),
                "path": list(resolution.path),
            }
            for currency, resolution in sorted(used_rates.items())
        },
    }
