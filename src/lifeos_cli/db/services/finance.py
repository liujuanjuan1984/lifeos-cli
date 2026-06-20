"""Unified finance tree and snapshot services."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.db.base import utc_now
from lifeos_cli.db.models.finance import (
    FinanceAsset,
    FinanceRateSnapshot,
    FinanceRateSnapshotEntry,
    FinanceSnapshot,
    FinanceSnapshotEntry,
    FinanceTree,
    FinanceTreeNode,
)

VALID_FINANCE_PURPOSES = {"balance", "cashflow", "custom"}
VALID_FINANCE_TIME_MODES = {"instant", "period"}
DEFAULT_FINANCE_CURRENCY = "USD"
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


class FinanceValidationError(ValueError):
    """Raised when finance input is invalid."""


class FinanceTreeNotFoundError(LookupError):
    """Raised when a finance tree cannot be found."""


class FinanceTreeAlreadyExistsError(ValueError):
    """Raised when a finance tree name is already used for a purpose."""


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


def normalize_finance_purpose(purpose: str) -> str:
    """Validate and normalize a finance tree purpose."""
    normalized = purpose.strip().lower()
    if normalized not in VALID_FINANCE_PURPOSES:
        allowed = ", ".join(sorted(VALID_FINANCE_PURPOSES))
        raise FinanceValidationError(f"Finance purpose must be one of: {allowed}")
    return normalized


def normalize_finance_time_mode(time_mode: str) -> str:
    """Validate and normalize a finance snapshot time mode."""
    normalized = time_mode.strip().lower()
    if normalized not in VALID_FINANCE_TIME_MODES:
        allowed = ", ".join(sorted(VALID_FINANCE_TIME_MODES))
        raise FinanceValidationError(f"Finance time mode must be one of: {allowed}")
    return normalized


def default_time_mode_for_purpose(purpose: str) -> str:
    """Return the default time mode for a finance purpose."""
    normalized = normalize_finance_purpose(purpose)
    if normalized == "cashflow":
        return "period"
    return "instant"


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


async def ensure_default_finance_assets(session: AsyncSession) -> None:
    """Create built-in assets only when the code has never existed."""
    existing_codes = set((await session.execute(select(FinanceAsset.code))).scalars().all())
    for code, name, display_order in DEFAULT_FINANCE_ASSETS:
        if code in existing_codes:
            continue
        session.add(
            FinanceAsset(
                code=code,
                name=name,
                display_order=display_order,
                is_default=True,
            )
        )
    await session.flush()


async def list_finance_assets(
    session: AsyncSession,
    *,
    include_deleted: bool = False,
    limit: int = 200,
    offset: int = 0,
) -> list[FinanceAsset]:
    """List finance assets."""
    if not include_deleted:
        await ensure_default_finance_assets(session)
    stmt = select(FinanceAsset)
    if not include_deleted:
        stmt = stmt.where(FinanceAsset.deleted_at.is_(None))
    stmt = stmt.order_by(FinanceAsset.display_order.asc(), FinanceAsset.code.asc())
    stmt = stmt.offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


async def count_finance_assets(
    session: AsyncSession,
    *,
    include_deleted: bool = False,
) -> int:
    """Count finance assets."""
    if not include_deleted:
        await ensure_default_finance_assets(session)
    stmt = select(func.count()).select_from(FinanceAsset)
    if not include_deleted:
        stmt = stmt.where(FinanceAsset.deleted_at.is_(None))
    return int((await session.execute(stmt)).scalar_one())


async def create_finance_asset(
    session: AsyncSession,
    *,
    code: str,
    name: str | None = None,
    display_order: int = 1000,
    is_default: bool = False,
    metadata: dict[str, Any] | None = None,
) -> FinanceAsset:
    """Create a selectable finance asset."""
    resolved_code = normalize_currency_code(code)
    existing = (
        await session.execute(
            select(FinanceAsset.id).where(
                FinanceAsset.code == resolved_code,
                FinanceAsset.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise FinanceAssetAlreadyExistsError(f"Finance asset {resolved_code!r} already exists")
    asset = FinanceAsset(
        code=resolved_code,
        name=validate_asset_name(name),
        display_order=display_order,
        is_default=is_default,
        metadata_json=metadata,
    )
    session.add(asset)
    await session.flush()
    await session.refresh(asset)
    return asset


async def update_finance_asset(
    session: AsyncSession,
    *,
    asset_id: UUID,
    code: str | None = None,
    name: str | None = None,
    display_order: int | None = None,
) -> FinanceAsset:
    """Update a finance asset."""
    asset = (
        await session.execute(
            select(FinanceAsset).where(
                FinanceAsset.id == asset_id,
                FinanceAsset.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if asset is None:
        raise FinanceAssetNotFoundError(f"Finance asset {asset_id} was not found")
    if code is not None:
        resolved_code = normalize_currency_code(code)
        existing = (
            await session.execute(
                select(FinanceAsset.id).where(
                    FinanceAsset.code == resolved_code,
                    FinanceAsset.deleted_at.is_(None),
                    FinanceAsset.id != asset.id,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise FinanceAssetAlreadyExistsError(f"Finance asset {resolved_code!r} already exists")
        asset.code = resolved_code
    if name is not None:
        asset.name = validate_asset_name(name)
    if display_order is not None:
        asset.display_order = display_order
    await session.flush()
    await session.refresh(asset)
    return asset


async def delete_finance_asset(session: AsyncSession, *, asset_id: UUID) -> None:
    """Soft-delete one finance asset."""
    asset = (
        await session.execute(
            select(FinanceAsset).where(
                FinanceAsset.id == asset_id,
                FinanceAsset.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if asset is None:
        raise FinanceAssetNotFoundError(f"Finance asset {asset_id} was not found")
    asset.soft_delete()


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


async def _ensure_tree_name_available(
    session: AsyncSession,
    *,
    purpose: str,
    name: str,
    excluding_tree_id: UUID | None = None,
) -> None:
    stmt = select(FinanceTree.id).where(
        FinanceTree.purpose == purpose,
        FinanceTree.name == name,
        FinanceTree.deleted_at.is_(None),
    )
    if excluding_tree_id is not None:
        stmt = stmt.where(FinanceTree.id != excluding_tree_id)
    existing_id = (await session.execute(stmt.limit(1))).scalar_one_or_none()
    if existing_id is not None:
        raise FinanceTreeAlreadyExistsError(
            f"Finance tree named {name!r} already exists for purpose {purpose!r}"
        )


async def _ensure_node_name_available(
    session: AsyncSession,
    *,
    tree_id: UUID,
    parent_id: UUID | None,
    name: str,
    excluding_node_id: UUID | None = None,
) -> None:
    stmt = select(FinanceTreeNode.id).where(
        FinanceTreeNode.tree_id == tree_id,
        FinanceTreeNode.name == name,
        FinanceTreeNode.deleted_at.is_(None),
    )
    stmt = stmt.where(
        FinanceTreeNode.parent_id.is_(None)
        if parent_id is None
        else FinanceTreeNode.parent_id == parent_id
    )
    if excluding_node_id is not None:
        stmt = stmt.where(FinanceTreeNode.id != excluding_node_id)
    existing_id = (await session.execute(stmt.limit(1))).scalar_one_or_none()
    if existing_id is not None:
        raise FinanceTreeNodeAlreadyExistsError(
            f"Finance node named {name!r} already exists under this parent"
        )


async def get_finance_tree(
    session: AsyncSession,
    *,
    tree_id: UUID,
    include_deleted: bool = False,
) -> FinanceTree | None:
    """Load one finance tree."""
    stmt = select(FinanceTree).where(FinanceTree.id == tree_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_finance_tree_with_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
    include_deleted: bool = False,
) -> FinanceTree | None:
    """Load one finance tree with all nodes."""
    stmt = (
        select(FinanceTree)
        .options(selectinload(FinanceTree.nodes))
        .where(FinanceTree.id == tree_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    tree = (await session.execute(stmt)).scalar_one_or_none()
    if tree is None:
        return None
    if not include_deleted:
        tree.nodes = [node for node in tree.nodes if node.deleted_at is None]
    return tree


async def list_finance_trees(
    session: AsyncSession,
    *,
    purpose: str | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[FinanceTree]:
    """List finance trees."""
    stmt = select(FinanceTree)
    if purpose is not None:
        stmt = stmt.where(FinanceTree.purpose == normalize_finance_purpose(purpose))
    if not include_deleted:
        stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    stmt = (
        stmt.order_by(
            FinanceTree.purpose.asc(),
            FinanceTree.display_order.asc(),
            FinanceTree.name.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def count_finance_trees(
    session: AsyncSession,
    *,
    purpose: str | None = None,
    include_deleted: bool = False,
) -> int:
    """Count finance trees."""
    stmt = select(func.count()).select_from(FinanceTree)
    if purpose is not None:
        stmt = stmt.where(FinanceTree.purpose == normalize_finance_purpose(purpose))
    if not include_deleted:
        stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    return int((await session.execute(stmt)).scalar_one())


async def _clear_other_defaults(
    session: AsyncSession,
    *,
    purpose: str,
    default_tree: FinanceTree,
) -> None:
    stmt = select(FinanceTree).where(
        FinanceTree.purpose == purpose,
        FinanceTree.deleted_at.is_(None),
        FinanceTree.is_default.is_(True),
    )
    for tree in (await session.execute(stmt)).scalars():
        if tree is not default_tree:
            tree.is_default = False


async def create_finance_tree(
    session: AsyncSession,
    *,
    name: str,
    purpose: str = "custom",
    time_mode: str | None = None,
    primary_currency: str | None = None,
    display_order: int = 0,
    is_default: bool = False,
    metadata: dict[str, Any] | None = None,
) -> FinanceTree:
    """Create a finance tree."""
    resolved_purpose = normalize_finance_purpose(purpose)
    resolved_time_mode = normalize_finance_time_mode(
        time_mode or default_time_mode_for_purpose(resolved_purpose)
    )
    resolved_name = validate_tree_name(name)
    await _ensure_tree_name_available(session, purpose=resolved_purpose, name=resolved_name)
    tree = FinanceTree(
        name=resolved_name,
        purpose=resolved_purpose,
        time_mode=resolved_time_mode,
        primary_currency=normalize_currency_code(primary_currency),
        display_order=display_order,
        is_default=is_default,
        metadata_json=metadata,
    )
    session.add(tree)
    if is_default:
        await _clear_other_defaults(session, purpose=resolved_purpose, default_tree=tree)
    await session.flush()
    await session.refresh(tree)
    return tree


async def _get_node_model(
    session: AsyncSession,
    *,
    node_id: UUID,
    include_deleted: bool = False,
) -> FinanceTreeNode | None:
    stmt = (
        select(FinanceTreeNode)
        .options(selectinload(FinanceTreeNode.tree), selectinload(FinanceTreeNode.children))
        .where(FinanceTreeNode.id == node_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(FinanceTreeNode.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_finance_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
    include_deleted: bool = False,
) -> list[FinanceTreeNode]:
    """List finance nodes for one tree in tree order."""
    stmt = select(FinanceTreeNode).where(FinanceTreeNode.tree_id == tree_id)
    if not include_deleted:
        stmt = stmt.where(FinanceTreeNode.deleted_at.is_(None))
    stmt = stmt.order_by(FinanceTreeNode.path.asc(), FinanceTreeNode.display_order.asc())
    return list((await session.execute(stmt)).scalars())


async def create_finance_node(
    session: AsyncSession,
    *,
    tree_id: UUID,
    name: str,
    parent_id: UUID | None = None,
    currency_code: str | None = None,
    display_order: int = 0,
    metadata: dict[str, Any] | None = None,
) -> FinanceTreeNode:
    """Create a finance tree node."""
    tree = await get_finance_tree(session, tree_id=tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {tree_id} was not found")
    parent: FinanceTreeNode | None = None
    if parent_id is not None:
        parent = await _get_node_model(session, node_id=parent_id)
        if parent is None or parent.tree_id != tree_id:
            raise FinanceTreeNodeNotFoundError(f"Finance parent node {parent_id} was not found")
    resolved_name = validate_node_name(name)
    await _ensure_node_name_available(
        session,
        tree_id=tree_id,
        parent_id=parent_id,
        name=resolved_name,
    )
    node = FinanceTreeNode(
        tree_id=tree_id,
        parent_id=parent_id,
        name=resolved_name,
        currency_code=normalize_currency_code(currency_code, fallback=tree.primary_currency),
        depth=0 if parent is None else parent.depth + 1,
        display_order=display_order,
        metadata_json=metadata,
        path="pending",
    )
    session.add(node)
    await session.flush()
    node.path = str(node.id) if parent is None else f"{parent.path}/{node.id}"
    if parent is not None:
        parent.children_count += 1
    await session.flush()
    await session.refresh(node)
    return node


async def update_finance_node(
    session: AsyncSession,
    *,
    node_id: UUID,
    name: str | None = None,
    currency_code: str | None = None,
    display_order: int | None = None,
) -> FinanceTreeNode:
    """Update mutable finance node fields."""
    node = await _get_node_model(session, node_id=node_id)
    if node is None:
        raise FinanceTreeNodeNotFoundError(f"Finance node {node_id} was not found")
    if name is not None:
        resolved_name = validate_node_name(name)
        await _ensure_node_name_available(
            session,
            tree_id=node.tree_id,
            parent_id=node.parent_id,
            name=resolved_name,
            excluding_node_id=node.id,
        )
        node.name = resolved_name
    if currency_code is not None:
        node.currency_code = normalize_currency_code(currency_code)
    if display_order is not None:
        node.display_order = display_order
    await session.flush()
    await session.refresh(node)
    return node


async def delete_finance_node(session: AsyncSession, *, node_id: UUID) -> None:
    """Soft-delete a finance node and its descendants."""
    node = await _get_node_model(session, node_id=node_id)
    if node is None:
        raise FinanceTreeNodeNotFoundError(f"Finance node {node_id} was not found")
    descendant_stmt = select(FinanceTreeNode).where(
        FinanceTreeNode.tree_id == node.tree_id,
        FinanceTreeNode.path.startswith(f"{node.path}/"),
        FinanceTreeNode.deleted_at.is_(None),
    )
    descendants = list((await session.scalars(descendant_stmt)).all())
    for descendant in descendants:
        descendant.soft_delete()
    node.soft_delete()
    if node.parent_id is not None:
        parent = await _get_node_model(session, node_id=node.parent_id)
        if parent is not None and parent.children_count > 0:
            parent.children_count -= 1


def _validate_snapshot_time_fields(
    *,
    tree: FinanceTree,
    snapshot_ts: datetime | None,
    period_start: datetime | None,
    period_end: datetime | None,
) -> tuple[datetime | None, datetime | None, datetime | None]:
    if tree.time_mode == "instant":
        return snapshot_ts or utc_now(), None, None
    if period_start is None or period_end is None:
        raise FinanceValidationError("Period finance snapshots require period_start and period_end")
    if period_end < period_start:
        raise FinanceValidationError("Finance snapshot period_end must be after period_start")
    return snapshot_ts or utc_now(), period_start, period_end


async def _load_entry_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
    entries: list[FinanceSnapshotEntryInput],
) -> dict[UUID, FinanceTreeNode]:
    if not entries:
        raise FinanceValidationError("Finance snapshot requires at least one entry")
    node_ids = [entry.node_id for entry in entries]
    if len(set(node_ids)) != len(node_ids):
        raise FinanceValidationError("Finance snapshot entries must reference unique nodes")
    stmt = select(FinanceTreeNode).where(
        FinanceTreeNode.id.in_(node_ids),
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


def _decimal(value: Decimal | int | str) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _quantize_amount(value: Decimal) -> Decimal:
    return value.quantize(FINANCE_AMOUNT_QUANT, rounding=ROUND_HALF_UP)


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
        primary_currency=None,
        captured_at=resolved_captured_at,
        source=_rate_snapshot_source(source),
        note=note,
        metadata_json=metadata,
    )
    session.add(rate_snapshot)
    await session.flush()

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

    await session.flush()
    await session.refresh(rate_snapshot)
    reloaded = await get_finance_rate_snapshot(session, rate_snapshot_id=rate_snapshot.id)
    return reloaded or rate_snapshot


async def get_finance_rate_snapshot(
    session: AsyncSession,
    *,
    rate_snapshot_id: UUID,
    include_deleted: bool = False,
) -> FinanceRateSnapshot | None:
    """Load one finance rate snapshot with entries."""
    stmt = (
        select(FinanceRateSnapshot)
        .options(selectinload(FinanceRateSnapshot.entries))
        .where(FinanceRateSnapshot.id == rate_snapshot_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(FinanceRateSnapshot.deleted_at.is_(None))
    rate_snapshot = (await session.execute(stmt)).scalar_one_or_none()
    if rate_snapshot is None:
        return None
    if not include_deleted:
        rate_snapshot.entries = [
            entry for entry in rate_snapshot.entries if entry.deleted_at is None
        ]
    return rate_snapshot


async def list_finance_rate_snapshots(
    session: AsyncSession,
    *,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[FinanceRateSnapshot]:
    """List exchange-rate snapshots."""
    stmt = select(FinanceRateSnapshot).options(selectinload(FinanceRateSnapshot.entries))
    if not include_deleted:
        stmt = stmt.where(FinanceRateSnapshot.deleted_at.is_(None))
    stmt = (
        stmt.order_by(
            FinanceRateSnapshot.captured_at.desc(),
            FinanceRateSnapshot.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    snapshots = list((await session.execute(stmt)).scalars())
    if not include_deleted:
        for snapshot in snapshots:
            snapshot.entries = [entry for entry in snapshot.entries if entry.deleted_at is None]
    return snapshots


async def count_finance_rate_snapshots(
    session: AsyncSession,
    *,
    include_deleted: bool = False,
) -> int:
    """Count exchange-rate snapshots."""
    stmt = select(func.count()).select_from(FinanceRateSnapshot)
    if not include_deleted:
        stmt = stmt.where(FinanceRateSnapshot.deleted_at.is_(None))
    return int((await session.execute(stmt)).scalar_one())


def _resolve_rate(
    rate_snapshot: FinanceRateSnapshot | None,
    *,
    base_currency: str,
    quote_currency: str,
) -> tuple[Decimal, bool, FinanceRateSnapshotEntry | None]:
    if base_currency == quote_currency:
        return Decimal("1"), False, None
    if rate_snapshot is None:
        raise FinanceValidationError(
            f"Finance snapshot requires a rate snapshot for {base_currency}/{quote_currency}"
        )
    entries = [entry for entry in rate_snapshot.entries if entry.deleted_at is None]
    direct = next(
        (
            entry
            for entry in entries
            if entry.base_currency == base_currency and entry.quote_currency == quote_currency
        ),
        None,
    )
    if direct is not None:
        return _validate_rate(direct.rate), False, direct
    inverse = next(
        (
            entry
            for entry in entries
            if entry.base_currency == quote_currency and entry.quote_currency == base_currency
        ),
        None,
    )
    if inverse is not None:
        return Decimal("1") / _validate_rate(inverse.rate), True, inverse
    raise FinanceValidationError(
        f"Rate snapshot {rate_snapshot.id} does not include {base_currency}/{quote_currency}"
    )


async def _select_rate_snapshot_for_entries(
    session: AsyncSession,
    *,
    explicit_rate_snapshot_id: UUID | None,
) -> tuple[FinanceRateSnapshot | None, str]:
    if explicit_rate_snapshot_id is not None:
        rate_snapshot = await get_finance_rate_snapshot(
            session,
            rate_snapshot_id=explicit_rate_snapshot_id,
        )
        if rate_snapshot is None:
            raise FinanceRateSnapshotNotFoundError(
                f"Finance rate snapshot {explicit_rate_snapshot_id} was not found"
            )
        return rate_snapshot, "selected"
    return None, "none"


def _rate_usage_payload(
    *,
    primary_currency: str,
    rate_snapshot: FinanceRateSnapshot | None,
    used_rates: dict[str, tuple[Decimal, bool, FinanceRateSnapshotEntry | None]],
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
                "rate": _format_rate(rate),
                "derived": derived,
                "source_rate_entry_id": str(source_entry.id) if source_entry is not None else None,
                "source_pair": (
                    f"{source_entry.base_currency}/{source_entry.quote_currency}"
                    if source_entry is not None
                    else f"{currency}/{primary_currency}"
                ),
            }
            for currency, (rate, derived, source_entry) in sorted(used_rates.items())
        },
    }


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
) -> dict[str, Any]:
    manual_entries = [entry for entry in entries if not entry.is_auto_generated]
    totals_by_currency = _build_currency_totals(manual_entries)
    total_positive = sum(
        (entry.amount_converted for entry in manual_entries if entry.amount_converted > 0),
        Decimal("0"),
    )
    total_negative = sum(
        (entry.amount_converted for entry in manual_entries if entry.amount_converted < 0),
        Decimal("0"),
    )
    return {
        "manual_entry_count": str(len(manual_entries)),
        "entry_count": str(len(entries)),
        "total_positive": str(total_positive),
        "total_negative": str(total_negative),
        "net_amount": str(total_positive + total_negative),
        "primary_currency": primary_currency,
        "rate_snapshot_id": str(rate_snapshot.id) if rate_snapshot is not None else None,
        "aggregation_mode": "converted" if rate_snapshot is not None else "native_by_currency",
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
    snapshot_entries: list[FinanceSnapshotEntry] = []
    entry_by_node_id: dict[UUID, FinanceSnapshotEntry] = {}
    used_rates: dict[str, tuple[Decimal, bool, FinanceRateSnapshotEntry | None]] = {}
    for entry_input in entries:
        node = entry_nodes[entry_input.node_id]
        amount = _decimal(entry_input.amount)
        currency_code = normalize_currency_code(
            entry_input.currency_code,
            fallback=node.currency_code or snapshot.primary_currency,
        )
        if rate_snapshot is not None:
            rate, derived, source_entry = _resolve_rate(
                rate_snapshot,
                base_currency=currency_code,
                quote_currency=snapshot.primary_currency,
            )
            if currency_code != snapshot.primary_currency:
                used_rates[currency_code] = (rate, derived, source_entry)
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
        entry_by_node_id[node.id] = entry

    rollup_nodes = await _load_rollup_nodes(session, tree_id=tree.id)
    all_nodes = {node.id: node for node in await list_finance_nodes(session, tree_id=tree.id)}
    for rollup_node in rollup_nodes:
        if rollup_node.id in entry_by_node_id:
            continue
        descendant_entries = [
            entry
            for node_id, entry in entry_by_node_id.items()
            if all_nodes.get(node_id) is not None
            and all_nodes[node_id].path.startswith(f"{rollup_node.path}/")
        ]
        if not descendant_entries:
            continue
        if rate_snapshot is None:
            descendant_currencies = {entry.currency_code for entry in descendant_entries}
            if len(descendant_currencies) != 1:
                continue
            rollup_currency = next(iter(descendant_currencies))
            amount = _quantize_amount(
                sum((entry.amount for entry in descendant_entries), Decimal("0"))
            )
            entry = FinanceSnapshotEntry(
                snapshot_id=snapshot.id,
                node_id=rollup_node.id,
                amount=amount,
                currency_code=rollup_currency,
                amount_converted=amount,
                is_auto_generated=True,
            )
        else:
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
        entry_by_node_id[rollup_node.id] = entry

    manual_entries = [entry for entry in snapshot_entries if not entry.is_auto_generated]
    total_source_entries = (
        manual_entries
        if rate_snapshot is not None
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
    snapshot.exchange_rates = _rate_usage_payload(
        primary_currency=snapshot.primary_currency,
        rate_snapshot=rate_snapshot,
        used_rates=used_rates,
    )
    snapshot.summary = _build_summary(
        snapshot_entries,
        primary_currency=snapshot.primary_currency,
        rate_snapshot=rate_snapshot,
    )
    await session.flush()
    await session.refresh(snapshot)
    return await get_finance_snapshot(session, snapshot_id=snapshot.id) or snapshot


async def create_finance_snapshot(
    session: AsyncSession,
    *,
    tree_id: UUID,
    entries: list[FinanceSnapshotEntryInput],
    snapshot_ts: datetime | None = None,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    primary_currency: str | None = None,
    rate_snapshot_id: UUID | None = None,
    note: str | None = None,
) -> FinanceSnapshot:
    """Create a finance snapshot and roll up aggregate nodes."""
    tree = await get_finance_tree(session, tree_id=tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {tree_id} was not found")
    resolved_snapshot_ts, resolved_period_start, resolved_period_end = (
        _validate_snapshot_time_fields(
            tree=tree,
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
    purpose: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[FinanceSnapshot]:
    """List finance snapshots."""
    stmt = (
        select(FinanceSnapshot)
        .options(selectinload(FinanceSnapshot.tree))
        .where(FinanceSnapshot.deleted_at.is_(None))
    )
    if tree_id is not None:
        stmt = stmt.where(FinanceSnapshot.tree_id == tree_id)
    if purpose is not None:
        stmt = stmt.join(FinanceTree).where(
            FinanceTree.purpose == normalize_finance_purpose(purpose)
        )
    stmt = (
        stmt.order_by(
            FinanceSnapshot.snapshot_ts.desc().nullslast(),
            FinanceSnapshot.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def update_finance_snapshot_rate_snapshot(
    session: AsyncSession,
    *,
    snapshot_id: UUID,
    rate_snapshot_id: UUID | None,
) -> FinanceSnapshot:
    """Change a snapshot's exchange-rate snapshot and recompute derived amounts."""
    return await update_finance_snapshot(
        session,
        snapshot_id=snapshot_id,
        rate_snapshot_id=rate_snapshot_id,
        update_rate_snapshot=True,
    )


async def update_finance_snapshot(
    session: AsyncSession,
    *,
    snapshot_id: UUID,
    entries: list[FinanceSnapshotEntryInput] | None = None,
    snapshot_ts: datetime | None = None,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    primary_currency: str | None = None,
    rate_snapshot_id: UUID | None = None,
    note: str | None = None,
    update_time_fields: bool = False,
    update_primary_currency: bool = False,
    update_rate_snapshot: bool = False,
    update_note: bool = False,
) -> FinanceSnapshot:
    """Update a finance snapshot and recompute derived amounts when needed."""
    snapshot = await get_finance_snapshot(session, snapshot_id=snapshot_id)
    if snapshot is None:
        raise FinanceTreeNotFoundError(f"Finance snapshot {snapshot_id} was not found")
    tree = snapshot.tree or await get_finance_tree(session, tree_id=snapshot.tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {snapshot.tree_id} was not found")

    if update_time_fields:
        resolved_snapshot_ts, resolved_period_start, resolved_period_end = (
            _validate_snapshot_time_fields(
                tree=tree,
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
    include_deleted: bool = False,
) -> FinanceSnapshot | None:
    """Load one finance snapshot with entries and node metadata."""
    stmt = (
        select(FinanceSnapshot)
        .options(
            selectinload(FinanceSnapshot.tree),
            selectinload(FinanceSnapshot.rate_snapshot),
            selectinload(FinanceSnapshot.entries).selectinload(FinanceSnapshotEntry.node),
        )
        .where(FinanceSnapshot.id == snapshot_id)
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(FinanceSnapshot.deleted_at.is_(None))
    snapshot = (await session.execute(stmt)).scalar_one_or_none()
    if snapshot is None:
        return None
    if not include_deleted:
        snapshot.entries = [entry for entry in snapshot.entries if entry.deleted_at is None]
    return snapshot


async def count_finance_snapshots(
    session: AsyncSession,
    *,
    tree_id: UUID | None = None,
    purpose: str | None = None,
) -> int:
    """Count finance snapshots."""
    stmt = (
        select(func.count())
        .select_from(FinanceSnapshot)
        .where(FinanceSnapshot.deleted_at.is_(None))
    )
    if tree_id is not None:
        stmt = stmt.where(FinanceSnapshot.tree_id == tree_id)
    if purpose is not None:
        stmt = stmt.join(FinanceTree).where(
            FinanceTree.purpose == normalize_finance_purpose(purpose)
        )
    return int((await session.execute(stmt)).scalar_one())


async def ensure_default_finance_tree(
    session: AsyncSession,
    *,
    purpose: str,
    primary_currency: str | None = None,
) -> FinanceTree:
    """Ensure a default balance or cashflow tree exists."""
    resolved_purpose = normalize_finance_purpose(purpose)
    stmt = (
        select(FinanceTree)
        .where(
            FinanceTree.purpose == resolved_purpose,
            FinanceTree.is_default.is_(True),
            FinanceTree.deleted_at.is_(None),
        )
        .limit(1)
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing
    if resolved_purpose == "balance":
        tree = await create_finance_tree(
            session,
            name="Balance Sheet",
            purpose="balance",
            time_mode="instant",
            primary_currency=primary_currency,
            display_order=0,
            is_default=True,
        )
        await create_finance_node(
            session,
            tree_id=tree.id,
            name="Assets",
            display_order=0,
        )
        await create_finance_node(
            session,
            tree_id=tree.id,
            name="Liabilities",
            display_order=1,
        )
        return tree
    if resolved_purpose == "cashflow":
        tree = await create_finance_tree(
            session,
            name="Cashflow",
            purpose="cashflow",
            time_mode="period",
            primary_currency=primary_currency,
            display_order=1,
            is_default=True,
        )
        await create_finance_node(
            session,
            tree_id=tree.id,
            name="Inflows",
            display_order=0,
        )
        await create_finance_node(
            session,
            tree_id=tree.id,
            name="Outflows",
            display_order=1,
        )
        return tree
    return await create_finance_tree(
        session,
        name="Finance",
        purpose="custom",
        time_mode="instant",
        primary_currency=primary_currency,
        is_default=True,
    )
