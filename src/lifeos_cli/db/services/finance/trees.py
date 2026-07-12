"""Finance tree and node services."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.finance import (
    FinanceSnapshot,
    FinanceTree,
    FinanceTreeNode,
)

from ._core import (
    FinanceTreeAlreadyExistsError,
    FinanceTreeNodeAlreadyExistsError,
    FinanceTreeNodeNotFoundError,
    FinanceTreeNotFoundError,
    FinanceValidationError,
    _finance_node_children_loader,
    _finance_node_tree_loader,
    _finance_tree_nodes_loader,
    normalize_currency_code,
    validate_node_name,
    validate_tree_name,
)


async def _ensure_tree_name_available(
    session: AsyncSession,
    *,
    name: str,
    excluding_tree_id: UUID | None = None,
) -> None:
    stmt = select(FinanceTree.id).where(
        FinanceTree.name == name,
        FinanceTree.deleted_at.is_(None),
    )
    if excluding_tree_id is not None:
        stmt = stmt.where(FinanceTree.id != excluding_tree_id)
    existing_id = (await session.execute(stmt.limit(1))).scalar_one_or_none()
    if existing_id is not None:
        raise FinanceTreeAlreadyExistsError(f"Finance tree named {name!r} already exists")


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
) -> FinanceTree | None:
    """Load one finance tree."""
    stmt = select(FinanceTree).where(FinanceTree.id == tree_id).limit(1)
    stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_finance_tree_with_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
) -> FinanceTree | None:
    """Load one finance tree with all nodes."""
    stmt = (
        select(FinanceTree)
        .options(_finance_tree_nodes_loader())
        .where(FinanceTree.id == tree_id)
        .limit(1)
    )
    stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    tree = (await session.execute(stmt)).scalar_one_or_none()
    if tree is None:
        return None
    return tree


async def list_finance_trees(
    session: AsyncSession,
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[FinanceTree]:
    """List finance trees."""
    stmt = select(FinanceTree)
    stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    stmt = (
        stmt.order_by(
            FinanceTree.display_order.asc(),
            FinanceTree.name.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


async def count_finance_trees(
    session: AsyncSession,
) -> int:
    """Count finance trees."""
    stmt = select(func.count()).select_from(FinanceTree)
    stmt = stmt.where(FinanceTree.deleted_at.is_(None))
    return int((await session.execute(stmt)).scalar_one())


async def _clear_other_defaults(
    session: AsyncSession,
    *,
    default_tree: FinanceTree,
) -> None:
    stmt = select(FinanceTree).where(
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
    primary_currency: str | None = None,
    display_order: int = 0,
    is_default: bool = False,
    metadata: dict[str, Any] | None = None,
) -> FinanceTree:
    """Create a finance tree."""
    resolved_name = validate_tree_name(name)
    await _ensure_tree_name_available(session, name=resolved_name)
    tree = FinanceTree(
        name=resolved_name,
        primary_currency=normalize_currency_code(primary_currency),
        display_order=display_order,
        is_default=is_default,
        metadata_json=metadata,
    )
    session.add(tree)
    if is_default:
        await _clear_other_defaults(session, default_tree=tree)
    await session.flush()
    await session.refresh(tree)
    return tree


async def update_finance_tree(
    session: AsyncSession,
    *,
    tree_id: UUID,
    name: str | None = None,
    primary_currency: str | None = None,
    display_order: int | None = None,
    is_default: bool | None = None,
    metadata: dict[str, Any] | None = None,
    update_metadata: bool = False,
) -> FinanceTree:
    """Update mutable finance tree fields."""
    tree = await get_finance_tree(session, tree_id=tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {tree_id} was not found")

    if name is not None:
        resolved_name = validate_tree_name(name)
        if resolved_name != tree.name:
            await _ensure_tree_name_available(
                session,
                name=resolved_name,
                excluding_tree_id=tree.id,
            )
            tree.name = resolved_name
    if primary_currency is not None:
        tree.primary_currency = normalize_currency_code(primary_currency)
    if display_order is not None:
        tree.display_order = display_order
    if is_default is not None:
        tree.is_default = is_default
        if is_default:
            await _clear_other_defaults(session, default_tree=tree)
    if update_metadata:
        tree.metadata_json = metadata

    await session.flush()
    await session.refresh(tree)
    return tree


async def delete_finance_tree(
    session: AsyncSession,
    *,
    tree_id: UUID,
) -> None:
    """Soft-delete a finance tree that has no active snapshots."""
    tree = await get_finance_tree_with_nodes(session, tree_id=tree_id)
    if tree is None:
        raise FinanceTreeNotFoundError(f"Finance tree {tree_id} was not found")
    snapshot_count = await session.scalar(
        select(func.count())
        .select_from(FinanceSnapshot)
        .where(
            FinanceSnapshot.tree_id == tree.id,
            FinanceSnapshot.deleted_at.is_(None),
        )
    )
    if snapshot_count:
        raise FinanceValidationError("Finance tree cannot be deleted while it has snapshots")
    for node in tree.nodes:
        node.soft_delete()
    tree.soft_delete()
    await session.flush()


async def _get_node_model(
    session: AsyncSession,
    *,
    node_id: UUID,
) -> FinanceTreeNode | None:
    stmt = (
        select(FinanceTreeNode)
        .options(
            _finance_node_tree_loader(),
            _finance_node_children_loader(),
        )
        .where(FinanceTreeNode.id == node_id)
        .limit(1)
    )
    stmt = stmt.where(FinanceTreeNode.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_finance_nodes(
    session: AsyncSession,
    *,
    tree_id: UUID,
) -> list[FinanceTreeNode]:
    """List finance nodes for one tree in tree order."""
    stmt = select(FinanceTreeNode).where(FinanceTreeNode.tree_id == tree_id)
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


async def ensure_default_finance_tree(
    session: AsyncSession,
    *,
    primary_currency: str | None = None,
) -> FinanceTree:
    """Ensure one global default finance tree exists."""
    stmt = (
        select(FinanceTree)
        .where(
            FinanceTree.is_default.is_(True),
            FinanceTree.deleted_at.is_(None),
        )
        .limit(1)
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing
    tree = await create_finance_tree(
        session,
        name="Finance",
        primary_currency=primary_currency,
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
