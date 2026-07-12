"""Unit tests for task read-model query composition."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import cast
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import task_queries
from lifeos_cli.db.services.read_models import TaskView


def test_list_task_read_models_combines_pagination_total_and_relation_counts(
    monkeypatch,
) -> None:
    task_id = UUID("11111111-1111-1111-1111-111111111111")
    task = cast(TaskView, SimpleNamespace(id=task_id))

    async def fake_list_tasks(_session: object, **kwargs: object) -> list[TaskView]:
        assert kwargs["limit"] == 50
        assert kwargs["offset"] == 50
        return [task]

    async def fake_count_tasks(_session: object, **kwargs: object) -> int:
        assert "limit" not in kwargs
        assert "offset" not in kwargs
        return 123

    async def fake_load_task_relation_counts(
        _session: object,
        *,
        task_ids: list[UUID],
    ) -> dict[UUID, tuple[int, int]]:
        assert task_ids == [task_id]
        return {task_id: (4, 5)}

    monkeypatch.setattr(task_queries, "list_tasks", fake_list_tasks)
    monkeypatch.setattr(task_queries, "count_tasks", fake_count_tasks)
    monkeypatch.setattr(task_queries, "load_task_relation_counts", fake_load_task_relation_counts)

    result = asyncio.run(
        task_queries.list_task_read_models(
            cast(AsyncSession, object()),
            query="Needle",
            limit=50,
            offset=50,
        )
    )

    assert result.total == 123
    assert result.items == (
        task_queries.TaskReadModel(task=task, notes_count=4, timelogs_count=5),
    )


def test_list_task_read_models_returns_empty_items_without_relation_query(monkeypatch) -> None:
    async def fake_list_tasks(_session: object, **_kwargs: object) -> list[object]:
        return []

    async def fake_count_tasks(_session: object, **_kwargs: object) -> int:
        return 0

    async def fail_load_relation_counts(_session: object, **_kwargs: object) -> object:
        raise AssertionError("empty result must not require relationship count queries")

    monkeypatch.setattr(task_queries, "list_tasks", fake_list_tasks)
    monkeypatch.setattr(task_queries, "count_tasks", fake_count_tasks)
    monkeypatch.setattr(task_queries, "load_task_relation_counts", fail_load_relation_counts)

    result = asyncio.run(task_queries.list_task_read_models(cast(AsyncSession, object())))

    assert result.items == ()
    assert result.total == 0
