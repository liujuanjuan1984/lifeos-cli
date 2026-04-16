"""Shared model-loading helpers for service-layer code."""

from __future__ import annotations

from typing import Any, TypeVar, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")


async def load_model_by_id(
    session: AsyncSession,
    *,
    model_cls: type[ModelT],
    model_id: UUID,
    include_deleted: bool,
) -> ModelT | None:
    """Load one soft-deletable model by identifier."""
    stmt = select(model_cls).where(cast(Any, model_cls).id == model_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(cast(Any, model_cls).deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()
