from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import selectinload

from lifeos_cli.db.base import Base
from lifeos_cli.db.models.area import Area
from lifeos_cli.db.models.timelog import Timelog
from lifeos_cli.db.session import configure_async_engine
from tests.support import utc_datetime


async def _create_sqlite_session_factory() -> tuple[
    AsyncEngine,
    async_sessionmaker[AsyncSession],
]:
    engine = configure_async_engine(
        create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False, future=True)


def test_session_queries_exclude_soft_deleted_models_by_default() -> None:
    async def scenario() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                active_area = Area(name="Active")
                deleted_area = Area(name="Deleted")
                session.add_all([active_area, deleted_area])
                await session.flush()
                deleted_area.soft_delete()
                await session.commit()

            async with session_factory() as session:
                areas = list((await session.execute(select(Area))).scalars())

                assert [area.name for area in areas] == ["Active"]
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_session_relationship_loads_exclude_soft_deleted_models_by_default() -> None:
    async def scenario() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                area = Area(name="Deleted area")
                session.add(area)
                await session.flush()
                timelog = Timelog(
                    title="Deep work",
                    start_time=utc_datetime(2026, 6, 30, 13, 0),
                    end_time=utc_datetime(2026, 6, 30, 14, 0),
                    area_id=area.id,
                )
                session.add(timelog)
                await session.flush()
                area.soft_delete()
                await session.commit()

            async with session_factory() as session:
                loaded = (
                    await session.execute(select(Timelog).options(selectinload(Timelog.area)))
                ).scalar_one()

                assert loaded.area_id == area.id
                assert loaded.area is None
        finally:
            await engine.dispose()

    asyncio.run(scenario())
