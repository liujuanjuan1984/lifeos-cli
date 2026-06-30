from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from lifeos_cli.db.base import Base
from lifeos_cli.db.services import people, tags


async def _create_sqlite_session_factory() -> tuple[
    AsyncEngine,
    async_sessionmaker[AsyncSession],
]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return engine, async_sessionmaker(engine, expire_on_commit=False, future=True)


def test_count_person_tag_usage_counts_active_tagged_people() -> None:
    async def run() -> None:
        engine, session_factory = await _create_sqlite_session_factory()
        try:
            async with session_factory() as session:
                tag = await tags.create_tag(
                    session,
                    name="Mentor",
                    entity_type="person",
                    category="relationship",
                )
                active_person = await people.create_person(
                    session,
                    name="Alice",
                    tag_ids=[tag.id],
                )
                deleted_person = await people.create_person(
                    session,
                    name="Bob",
                    tag_ids=[tag.id],
                )
                await people.delete_person(session, person_id=deleted_person.id)

                counts = await tags.count_tag_usage_by_entity_type(
                    session,
                    entity_type="person",
                )

                assert counts == {tag.id: 1}
                assert await tags.count_tag_usage(session, tag_id=tag.id) == 1
                assert active_person.tags[0].id == tag.id
        finally:
            await engine.dispose()

    asyncio.run(run())
