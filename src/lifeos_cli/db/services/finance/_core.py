"""Shared finance service contracts and helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import selectinload

from lifeos_cli.db.models.finance import (
    FinanceRateSnapshot,
    FinanceRateSnapshotEntry,
    FinanceSnapshot,
    FinanceSnapshotEntry,
    FinanceTree,
    FinanceTreeNode,
)

DEFAULT_FINANCE_CURRENCY = "USD"
DEFAULT_FINANCE_ASSET_DECIMAL_PLACES = 2
MAX_FINANCE_ASSET_DECIMAL_PLACES = 8
DEFAULT_FINANCE_ASSETS: tuple[tuple[str, str, int], ...] = (
    ("USD", "US Dollar", 10),
    ("USDT", "Tether USD", 20),
    ("CNY", "Chinese Yuan", 30),
    ("BTC", "Bitcoin", 40),
    ("ETH", "Ethereum", 50),
    ("EUR", "Euro", 60),
)
FINANCE_AMOUNT_QUANT = Decimal("0.00000001")
FINANCE_RATE_QUANT = Decimal("0.000000000001")


def _finance_tree_nodes_loader() -> Any:
    return selectinload(FinanceTree.nodes.and_(FinanceTreeNode.deleted_at.is_(None)))


def _finance_node_tree_loader() -> Any:
    return selectinload(FinanceTreeNode.tree.and_(FinanceTree.deleted_at.is_(None)))


def _finance_node_children_loader() -> Any:
    return selectinload(FinanceTreeNode.children.and_(FinanceTreeNode.deleted_at.is_(None)))


def _finance_rate_entries_loader() -> Any:
    return selectinload(
        FinanceRateSnapshot.entries.and_(FinanceRateSnapshotEntry.deleted_at.is_(None))
    )


def _finance_snapshot_tree_loader() -> Any:
    return selectinload(FinanceSnapshot.tree.and_(FinanceTree.deleted_at.is_(None)))


def _finance_snapshot_rate_loader() -> Any:
    return selectinload(
        FinanceSnapshot.rate_snapshot.and_(FinanceRateSnapshot.deleted_at.is_(None))
    )


def _finance_snapshot_entries_loader() -> Any:
    entries = selectinload(FinanceSnapshot.entries.and_(FinanceSnapshotEntry.deleted_at.is_(None)))
    return entries.selectinload(
        FinanceSnapshotEntry.node.and_(FinanceTreeNode.deleted_at.is_(None))
    )


class FinanceValidationError(ValueError):
    """Raised when finance input is invalid."""


class FinanceTreeNotFoundError(LookupError):
    """Raised when a finance tree cannot be found."""


class FinanceTreeAlreadyExistsError(ValueError):
    """Raised when a finance tree name is already used."""


class FinanceTreeNodeNotFoundError(LookupError):
    """Raised when a finance tree node cannot be found."""


class FinanceTreeNodeAlreadyExistsError(ValueError):
    """Raised when a sibling finance node has the same name."""


class FinanceRateSnapshotNotFoundError(LookupError):
    """Raised when a finance rate snapshot cannot be found."""


class FinanceAssetNotFoundError(LookupError):
    """Raised when a finance asset cannot be found."""


class FinanceAssetAlreadyExistsError(ValueError):
    """Raised when a finance asset code is already active."""


@dataclass(frozen=True)
class FinanceSnapshotEntryInput:
    """Writable fields for a finance snapshot entry."""

    node_id: UUID
    amount: Decimal
    currency_code: str | None = None
    note: str | None = None


@dataclass(frozen=True)
class FinanceRateSnapshotEntryInput:
    """Writable fields for one exchange-rate snapshot entry."""

    base_currency: str
    quote_currency: str
    rate: Decimal
    source: str | None = None
    captured_at: datetime | None = None
    is_derived: bool = False
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class RateResolution:
    """Resolved conversion rate with auditable source path metadata."""

    rate: Decimal
    derived: bool
    source_entries: tuple[FinanceRateSnapshotEntry, ...]
    path: tuple[str, ...]
    source_pairs: tuple[str, ...]


def _decimal(value: Decimal | int | str) -> Decimal:
    """Convert supported numeric inputs to Decimal."""
    return value if isinstance(value, Decimal) else Decimal(str(value))


def normalize_currency_code(currency_code: str | None, *, fallback: str | None = None) -> str:
    """Normalize a currency or asset code."""
    candidate = currency_code if currency_code is not None else fallback
    if candidate is None:
        candidate = DEFAULT_FINANCE_CURRENCY
    normalized = candidate.strip().upper()
    if not normalized:
        raise FinanceValidationError("Currency code must not be empty")
    if len(normalized) > 16:
        raise FinanceValidationError("Currency code must be 16 characters or fewer")
    return normalized


def validate_asset_name(name: str | None) -> str | None:
    """Validate and normalize an optional finance asset display name."""
    if name is None:
        return None
    normalized = name.strip()
    if not normalized:
        return None
    if len(normalized) > 200:
        raise FinanceValidationError("Finance asset name must be 200 characters or fewer")
    return normalized


def validate_asset_decimal_places(decimal_places: int | None = None) -> int:
    """Validate asset display and input precision."""
    resolved = DEFAULT_FINANCE_ASSET_DECIMAL_PLACES if decimal_places is None else decimal_places
    if resolved < 0 or resolved > MAX_FINANCE_ASSET_DECIMAL_PLACES:
        raise FinanceValidationError("Finance asset decimal places must be between 0 and 8")
    return resolved


def decimal_quant_for_places(decimal_places: int) -> Decimal:
    """Return the Decimal quantum for a given number of fractional places."""
    if decimal_places <= 0:
        return Decimal("1")
    return Decimal("1").scaleb(-decimal_places)


def format_decimal_places(value: Decimal, decimal_places: int) -> str:
    """Format a decimal with fixed places and no scientific notation."""
    return format(value.quantize(decimal_quant_for_places(decimal_places)), "f")


def format_asset_amount(
    value: Decimal,
    *,
    currency_code: str | None,
    decimal_places_by_code: dict[str, int] | None = None,
) -> str:
    """Format an amount using the precision configured for its asset."""
    normalized = normalize_currency_code(currency_code)
    decimal_places = (decimal_places_by_code or {}).get(
        normalized,
        DEFAULT_FINANCE_ASSET_DECIMAL_PLACES,
    )
    return format_decimal_places(value, decimal_places)


def validate_tree_name(name: str) -> str:
    """Validate and normalize a finance tree name."""
    normalized = name.strip()
    if not normalized:
        raise FinanceValidationError("Finance tree name must not be empty")
    if len(normalized) > 200:
        raise FinanceValidationError("Finance tree name must be 200 characters or fewer")
    return normalized


def validate_node_name(name: str) -> str:
    """Validate and normalize a finance node name."""
    normalized = name.strip()
    if not normalized:
        raise FinanceValidationError("Finance node name must not be empty")
    if len(normalized) > 200:
        raise FinanceValidationError("Finance node name must be 200 characters or fewer")
    return normalized


def validate_snapshot_title(title: str | None) -> str | None:
    """Validate and normalize an optional finance snapshot display title."""
    if title is None:
        return None
    normalized = title.strip()
    if not normalized:
        return None
    if len(normalized) > 200:
        raise FinanceValidationError("Finance snapshot title must be 200 characters or fewer")
    return normalized
