"""Finance asset services."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.finance import (
    FinanceAsset,
)

from ._core import (
    DEFAULT_FINANCE_ASSET_DECIMAL_PLACES,
    DEFAULT_FINANCE_ASSETS,
    FinanceAssetAlreadyExistsError,
    FinanceAssetNotFoundError,
    normalize_currency_code,
    validate_asset_decimal_places,
    validate_asset_name,
)


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
                decimal_places=DEFAULT_FINANCE_ASSET_DECIMAL_PLACES,
                display_order=display_order,
                is_default=True,
            )
        )
    await session.flush()


async def list_finance_assets(
    session: AsyncSession,
    *,
    limit: int = 200,
    offset: int = 0,
) -> list[FinanceAsset]:
    """List finance assets."""
    await ensure_default_finance_assets(session)
    stmt = select(FinanceAsset)
    stmt = stmt.where(FinanceAsset.deleted_at.is_(None))
    stmt = stmt.order_by(FinanceAsset.display_order.asc(), FinanceAsset.code.asc())
    stmt = stmt.offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


async def count_finance_assets(
    session: AsyncSession,
) -> int:
    """Count finance assets."""
    await ensure_default_finance_assets(session)
    stmt = select(func.count()).select_from(FinanceAsset)
    stmt = stmt.where(FinanceAsset.deleted_at.is_(None))
    return int((await session.execute(stmt)).scalar_one())


async def create_finance_asset(
    session: AsyncSession,
    *,
    code: str,
    name: str | None = None,
    decimal_places: int | None = None,
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
        decimal_places=validate_asset_decimal_places(decimal_places),
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
    decimal_places: int | None = None,
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
    if decimal_places is not None:
        asset.decimal_places = validate_asset_decimal_places(decimal_places)
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
