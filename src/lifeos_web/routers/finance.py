"""Unified finance endpoints for the local Web UI."""

from __future__ import annotations

import math
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.finance import (
    FinanceAsset,
    FinanceRateSnapshot,
    FinanceRateSnapshotEntry,
    FinanceSnapshot,
    FinanceSnapshotEntry,
    FinanceTreeNode,
)
from lifeos_cli.db.services import finance as finance_services
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination
from lifeos_web.serialization import to_jsonable

router = APIRouter(prefix="/finance", tags=["finance"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


class FinanceTreeCreate(BaseModel):
    """Payload for creating a finance tree."""

    name: str
    purpose: str = "custom"
    time_mode: str | None = None
    primary_currency: str = "USD"
    display_order: int = 0
    is_default: bool = False
    metadata: dict[str, Any] | None = None


class FinanceAssetCreate(BaseModel):
    """Payload for creating a finance asset."""

    code: str
    name: str | None = None
    display_order: int = 1000
    is_default: bool = False
    metadata: dict[str, Any] | None = None


class FinanceAssetUpdate(BaseModel):
    """Payload for updating a finance asset."""

    code: str | None = None
    name: str | None = None
    display_order: int | None = None


class FinanceNodeCreate(BaseModel):
    """Payload for creating a finance tree node."""

    name: str
    parent_id: UUID | None = None
    currency_code: str | None = None
    display_order: int = 0
    metadata: dict[str, Any] | None = None


class FinanceNodeUpdate(BaseModel):
    """Payload for updating a finance tree node."""

    name: str | None = None
    currency_code: str | None = None
    display_order: int | None = None


class FinanceSnapshotEntryCreate(BaseModel):
    """Payload for one finance snapshot entry."""

    node_id: UUID
    amount: Decimal
    currency_code: str | None = None
    note: str | None = None


class FinanceSnapshotCreate(BaseModel):
    """Payload for creating a finance snapshot."""

    snapshot_ts: datetime | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None
    primary_currency: str | None = None
    rate_snapshot_id: UUID | None = None
    note: str | None = None
    entries: list[FinanceSnapshotEntryCreate] = Field(default_factory=list)


class FinanceSnapshotUpdate(BaseModel):
    """Payload for updating mutable finance snapshot fields."""

    rate_snapshot_id: UUID | None = None


class FinanceRateSnapshotEntryCreate(BaseModel):
    """Payload for one exchange-rate entry."""

    base_currency: str
    quote_currency: str
    rate: Decimal
    source: str | None = None
    captured_at: datetime | None = None
    is_derived: bool = False
    metadata: dict[str, Any] | None = None


class FinanceRateSnapshotCreate(BaseModel):
    """Payload for creating an exchange-rate snapshot."""

    captured_at: datetime | None = None
    source: str | None = None
    note: str | None = None
    metadata: dict[str, Any] | None = None
    entries: list[FinanceRateSnapshotEntryCreate] = Field(default_factory=list)


def _page_envelope(
    *,
    items: list[dict[str, object]],
    page: int,
    size: int,
    total: int,
    meta: dict[str, object] | None = None,
) -> ListResponse:
    pages = math.ceil(total / size) if size > 0 else 0
    return ListResponse(
        items=items,
        pagination=Pagination(page=page, size=size, total=total, pages=pages),
        meta=meta or {},
    )


def _decimal_str(value: Decimal | None) -> str | None:
    return None if value is None else str(value)


def _node_payload(node: FinanceTreeNode) -> dict[str, object]:
    return {
        "id": str(node.id),
        "tree_id": str(node.tree_id),
        "parent_id": str(node.parent_id) if node.parent_id else None,
        "name": node.name,
        "currency_code": node.currency_code,
        "path": node.path,
        "depth": node.depth,
        "display_order": node.display_order,
        "children_count": node.children_count,
        "metadata": to_jsonable(node.metadata_json),
        "created_at": node.created_at.isoformat(),
        "updated_at": node.updated_at.isoformat(),
        "deleted_at": node.deleted_at.isoformat() if node.deleted_at else None,
    }


def _asset_payload(asset: FinanceAsset) -> dict[str, object]:
    return {
        "id": str(asset.id),
        "code": asset.code,
        "name": asset.name,
        "display_order": asset.display_order,
        "is_default": asset.is_default,
        "metadata": to_jsonable(asset.metadata_json),
        "created_at": asset.created_at.isoformat(),
        "updated_at": asset.updated_at.isoformat(),
        "deleted_at": asset.deleted_at.isoformat() if asset.deleted_at else None,
    }


def _tree_payload(tree, *, nodes: list[FinanceTreeNode] | None = None) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": str(tree.id),
        "name": tree.name,
        "purpose": tree.purpose,
        "time_mode": tree.time_mode,
        "primary_currency": tree.primary_currency,
        "display_order": tree.display_order,
        "is_default": tree.is_default,
        "metadata": to_jsonable(tree.metadata_json),
        "created_at": tree.created_at.isoformat(),
        "updated_at": tree.updated_at.isoformat(),
        "deleted_at": tree.deleted_at.isoformat() if tree.deleted_at else None,
    }
    if nodes is not None:
        payload["nodes"] = [_node_payload(node) for node in nodes]
    return payload


def _entry_payload(entry: FinanceSnapshotEntry) -> dict[str, object]:
    return {
        "id": str(entry.id),
        "snapshot_id": str(entry.snapshot_id),
        "node_id": str(entry.node_id),
        "node_name": entry.node.name if entry.node else None,
        "node_path": entry.node.path if entry.node else None,
        "amount": _decimal_str(entry.amount),
        "currency_code": entry.currency_code,
        "amount_converted": _decimal_str(entry.amount_converted),
        "note": entry.note,
        "is_auto_generated": entry.is_auto_generated,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
        "deleted_at": entry.deleted_at.isoformat() if entry.deleted_at else None,
    }


def _rate_entry_payload(entry: FinanceRateSnapshotEntry) -> dict[str, object]:
    return {
        "id": str(entry.id),
        "rate_snapshot_id": str(entry.rate_snapshot_id),
        "base_currency": entry.base_currency,
        "quote_currency": entry.quote_currency,
        "rate": _decimal_str(entry.rate),
        "source": entry.source,
        "captured_at": entry.captured_at.isoformat() if entry.captured_at else None,
        "is_derived": entry.is_derived,
        "metadata": to_jsonable(entry.metadata_json),
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
        "deleted_at": entry.deleted_at.isoformat() if entry.deleted_at else None,
    }


def _rate_snapshot_payload(
    rate_snapshot: FinanceRateSnapshot,
    *,
    include_entries: bool = True,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": str(rate_snapshot.id),
        "captured_at": rate_snapshot.captured_at.isoformat(),
        "primary_currency": rate_snapshot.primary_currency,
        "source": rate_snapshot.source,
        "note": rate_snapshot.note,
        "metadata": to_jsonable(rate_snapshot.metadata_json),
        "created_at": rate_snapshot.created_at.isoformat(),
        "updated_at": rate_snapshot.updated_at.isoformat(),
        "deleted_at": rate_snapshot.deleted_at.isoformat() if rate_snapshot.deleted_at else None,
    }
    if include_entries:
        payload["entries"] = [_rate_entry_payload(entry) for entry in rate_snapshot.entries]
    return payload


def _snapshot_payload(
    snapshot: FinanceSnapshot,
    *,
    include_entries: bool = False,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "id": str(snapshot.id),
        "tree_id": str(snapshot.tree_id),
        "tree_name": snapshot.tree.name if snapshot.tree else None,
        "purpose": snapshot.tree.purpose if snapshot.tree else None,
        "time_mode": snapshot.tree.time_mode if snapshot.tree else None,
        "snapshot_ts": snapshot.snapshot_ts.isoformat() if snapshot.snapshot_ts else None,
        "period_start": snapshot.period_start.isoformat() if snapshot.period_start else None,
        "period_end": snapshot.period_end.isoformat() if snapshot.period_end else None,
        "primary_currency": snapshot.primary_currency,
        "rate_snapshot_id": str(snapshot.rate_snapshot_id) if snapshot.rate_snapshot_id else None,
        "rate_snapshot_policy": snapshot.rate_snapshot_policy,
        "total_positive": _decimal_str(snapshot.total_positive),
        "total_negative": _decimal_str(snapshot.total_negative),
        "net_amount": _decimal_str(snapshot.net_amount),
        "exchange_rates": to_jsonable(snapshot.exchange_rates),
        "summary": to_jsonable(snapshot.summary),
        "note": snapshot.note,
        "created_at": snapshot.created_at.isoformat(),
        "updated_at": snapshot.updated_at.isoformat(),
        "deleted_at": snapshot.deleted_at.isoformat() if snapshot.deleted_at else None,
    }
    if include_entries:
        payload["entries"] = [_entry_payload(entry) for entry in snapshot.entries]
    return payload


@router.get("/assets", response_model=ListResponse)
async def list_assets(
    session: SessionDep,
    include_deleted: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(200, ge=1, le=500),
) -> ListResponse:
    """List finance assets."""
    assets = await finance_services.list_finance_assets(
        session,
        include_deleted=include_deleted,
        limit=size,
        offset=(page - 1) * size,
    )
    total = await finance_services.count_finance_assets(
        session,
        include_deleted=include_deleted,
    )
    return _page_envelope(
        items=[_asset_payload(asset) for asset in assets],
        page=page,
        size=size,
        total=total,
        meta={"include_deleted": include_deleted},
    )


@router.post("/assets")
async def create_asset(payload: FinanceAssetCreate, session: SessionDep) -> dict[str, object]:
    """Create a finance asset."""
    try:
        asset = await finance_services.create_finance_asset(
            session,
            code=payload.code,
            name=payload.name,
            display_order=payload.display_order,
            is_default=payload.is_default,
            metadata=payload.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _asset_payload(asset)


@router.patch("/assets/{asset_id}")
async def update_asset(
    asset_id: UUID,
    payload: FinanceAssetUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a finance asset."""
    try:
        asset = await finance_services.update_finance_asset(
            session,
            asset_id=asset_id,
            code=payload.code,
            name=payload.name,
            display_order=payload.display_order,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _asset_payload(asset)


@router.delete("/assets/{asset_id}", status_code=204)
async def delete_asset(asset_id: UUID, session: SessionDep) -> None:
    """Soft-delete one finance asset."""
    try:
        await finance_services.delete_finance_asset(session, asset_id=asset_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/trees", response_model=ListResponse)
async def list_trees(
    session: SessionDep,
    purpose: str | None = None,
    include_deleted: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500),
) -> ListResponse:
    """List finance trees."""
    try:
        trees = await finance_services.list_finance_trees(
            session,
            purpose=purpose,
            include_deleted=include_deleted,
            limit=size,
            offset=(page - 1) * size,
        )
        total = await finance_services.count_finance_trees(
            session,
            purpose=purpose,
            include_deleted=include_deleted,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _page_envelope(
        items=[_tree_payload(tree) for tree in trees],
        page=page,
        size=size,
        total=total,
        meta={"purpose": purpose, "include_deleted": include_deleted},
    )


@router.get("/rate-snapshots", response_model=ListResponse)
async def list_rate_snapshots(
    session: SessionDep,
    include_deleted: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> ListResponse:
    """List exchange-rate snapshots."""
    try:
        rate_snapshots = await finance_services.list_finance_rate_snapshots(
            session,
            include_deleted=include_deleted,
            limit=size,
            offset=(page - 1) * size,
        )
        total = await finance_services.count_finance_rate_snapshots(
            session,
            include_deleted=include_deleted,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _page_envelope(
        items=[_rate_snapshot_payload(snapshot) for snapshot in rate_snapshots],
        page=page,
        size=size,
        total=total,
        meta={"include_deleted": include_deleted},
    )


@router.post("/rate-snapshots")
async def create_rate_snapshot(
    payload: FinanceRateSnapshotCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create an exchange-rate snapshot."""
    try:
        rate_snapshot = await finance_services.create_finance_rate_snapshot(
            session,
            captured_at=payload.captured_at,
            source=payload.source,
            note=payload.note,
            metadata=payload.metadata,
            entries=[
                finance_services.FinanceRateSnapshotEntryInput(
                    base_currency=entry.base_currency,
                    quote_currency=entry.quote_currency,
                    rate=entry.rate,
                    source=entry.source,
                    captured_at=entry.captured_at,
                    is_derived=entry.is_derived,
                    metadata=entry.metadata,
                )
                for entry in payload.entries
            ],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _rate_snapshot_payload(rate_snapshot)


@router.get("/rate-snapshots/{rate_snapshot_id}")
async def get_rate_snapshot(
    rate_snapshot_id: UUID,
    session: SessionDep,
) -> dict[str, object]:
    """Load one exchange-rate snapshot."""
    rate_snapshot = await finance_services.get_finance_rate_snapshot(
        session,
        rate_snapshot_id=rate_snapshot_id,
    )
    if rate_snapshot is None:
        raise HTTPException(
            status_code=404,
            detail=f"Finance rate snapshot {rate_snapshot_id} was not found",
        )
    return _rate_snapshot_payload(rate_snapshot)


@router.post("/trees")
async def create_tree(payload: FinanceTreeCreate, session: SessionDep) -> dict[str, object]:
    """Create a finance tree."""
    try:
        tree = await finance_services.create_finance_tree(
            session,
            name=payload.name,
            purpose=payload.purpose,
            time_mode=payload.time_mode,
            primary_currency=payload.primary_currency,
            display_order=payload.display_order,
            is_default=payload.is_default,
            metadata=payload.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _tree_payload(tree)


@router.post("/trees/ensure-default")
async def ensure_default_tree(
    session: SessionDep,
    purpose: str = Query(...),
    primary_currency: str | None = None,
) -> dict[str, object]:
    """Ensure the requested preset tree exists."""
    try:
        tree = await finance_services.ensure_default_finance_tree(
            session,
            purpose=purpose,
            primary_currency=primary_currency,
        )
        nodes = await finance_services.list_finance_nodes(session, tree_id=tree.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _tree_payload(tree, nodes=nodes)


@router.get("/trees/{tree_id}")
async def get_tree(tree_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one finance tree with nodes."""
    tree = await finance_services.get_finance_tree_with_nodes(session, tree_id=tree_id)
    if tree is None:
        raise HTTPException(status_code=404, detail=f"Finance tree {tree_id} was not found")
    return _tree_payload(tree, nodes=list(tree.nodes))


@router.post("/trees/{tree_id}/nodes")
async def create_node(
    tree_id: UUID,
    payload: FinanceNodeCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create a finance node under one tree."""
    try:
        node = await finance_services.create_finance_node(
            session,
            tree_id=tree_id,
            name=payload.name,
            parent_id=payload.parent_id,
            currency_code=payload.currency_code,
            display_order=payload.display_order,
            metadata=payload.metadata,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _node_payload(node)


@router.patch("/nodes/{node_id}")
async def update_node(
    node_id: UUID,
    payload: FinanceNodeUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update a finance node."""
    try:
        node = await finance_services.update_finance_node(
            session,
            node_id=node_id,
            name=payload.name,
            currency_code=payload.currency_code,
            display_order=payload.display_order,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _node_payload(node)


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(node_id: UUID, session: SessionDep) -> None:
    """Soft-delete one finance node."""
    try:
        await finance_services.delete_finance_node(session, node_id=node_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/trees/{tree_id}/snapshots", response_model=ListResponse)
async def list_tree_snapshots(
    tree_id: UUID,
    session: SessionDep,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> ListResponse:
    """List snapshots for one finance tree."""
    snapshots = await finance_services.list_finance_snapshots(
        session,
        tree_id=tree_id,
        limit=size,
        offset=(page - 1) * size,
    )
    total = await finance_services.count_finance_snapshots(session, tree_id=tree_id)
    return _page_envelope(
        items=[_snapshot_payload(snapshot) for snapshot in snapshots],
        page=page,
        size=size,
        total=total,
        meta={"tree_id": str(tree_id)},
    )


@router.post("/trees/{tree_id}/snapshots")
async def create_snapshot(
    tree_id: UUID,
    payload: FinanceSnapshotCreate,
    session: SessionDep,
) -> dict[str, object]:
    """Create a finance snapshot."""
    try:
        snapshot = await finance_services.create_finance_snapshot(
            session,
            tree_id=tree_id,
            snapshot_ts=payload.snapshot_ts,
            period_start=payload.period_start,
            period_end=payload.period_end,
            primary_currency=payload.primary_currency,
            rate_snapshot_id=payload.rate_snapshot_id,
            note=payload.note,
            entries=[
                finance_services.FinanceSnapshotEntryInput(
                    node_id=entry.node_id,
                    amount=entry.amount,
                    currency_code=entry.currency_code,
                    note=entry.note,
                )
                for entry in payload.entries
            ],
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _snapshot_payload(snapshot, include_entries=True)


@router.get("/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: UUID, session: SessionDep) -> dict[str, object]:
    """Load one finance snapshot with entries."""
    snapshot = await finance_services.get_finance_snapshot(session, snapshot_id=snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail=f"Finance snapshot {snapshot_id} was not found")
    return _snapshot_payload(snapshot, include_entries=True)


@router.patch("/snapshots/{snapshot_id}")
async def update_snapshot(
    snapshot_id: UUID,
    payload: FinanceSnapshotUpdate,
    session: SessionDep,
) -> dict[str, object]:
    """Update mutable finance snapshot fields."""
    try:
        snapshot = await finance_services.update_finance_snapshot_rate_snapshot(
            session,
            snapshot_id=snapshot_id,
            rate_snapshot_id=payload.rate_snapshot_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _snapshot_payload(snapshot, include_entries=True)
