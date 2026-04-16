"""Alembic environment configuration for lifeos_cli."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

import lifeos_cli.db.models  # noqa: F401, E402
from lifeos_cli.config import get_database_settings  # noqa: E402
from lifeos_cli.db.base import Base, apply_database_schema  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _load_database_settings():
    settings = get_database_settings()
    apply_database_schema(settings.database_schema)
    config.set_main_option("sqlalchemy.url", settings.require_database_url())
    return settings


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""
    settings = _load_database_settings()
    context.configure(
        url=settings.require_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        version_table_schema=settings.database_schema,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""
    settings = _load_database_settings()
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{settings.database_schema}"'))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            version_table_schema=settings.database_schema,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
