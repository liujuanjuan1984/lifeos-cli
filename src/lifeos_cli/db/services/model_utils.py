"""Shared model-loading helpers for service-layer code."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, TypeVar, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelT = TypeVar("ModelT")
ViewT = TypeVar("ViewT")


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


async def load_view_by_id(
    session: AsyncSession,
    *,
    model_cls: type[ModelT],
    model_id: UUID,
    include_deleted: bool,
    view_builder: Callable[[AsyncSession, ModelT], Awaitable[ViewT]],
) -> ViewT | None:
    """Load one model by identifier and render it through one async view builder."""
    record = await load_model_by_id(
        session,
        model_cls=model_cls,
        model_id=model_id,
        include_deleted=include_deleted,
    )
    if record is None:
        return None
    return await view_builder(session, record)


async def soft_delete_model_by_id(
    session: AsyncSession,
    *,
    model_cls: type[ModelT],
    model_id: UUID,
    not_found_error_factory: Callable[[UUID], Exception],
) -> None:
    """Soft-delete one model by identifier or raise one caller-supplied error."""
    record = await load_model_by_id(
        session,
        model_cls=model_cls,
        model_id=model_id,
        include_deleted=False,
    )
    if record is None:
        raise not_found_error_factory(model_id)
    cast(Any, record).soft_delete()
    await session.flush()


async def ensure_optional_reference_exists(
    session: AsyncSession,
    *,
    model_cls: type[ModelT],
    model_id: UUID | None,
    not_found_error_factory: Callable[[UUID], Exception],
) -> None:
    """Ensure one optional soft-deletable reference exists."""
    if model_id is None:
        return
    record = await load_model_by_id(
        session,
        model_cls=model_cls,
        model_id=model_id,
        include_deleted=False,
    )
    if record is None:
        raise not_found_error_factory(model_id)
