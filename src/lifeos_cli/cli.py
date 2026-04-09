"""CLI entrypoint for the lifeos_cli package."""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Callable, Coroutine, Sequence
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from typing import Protocol
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from lifeos_cli.config import (
    ConfigurationError,
    DatabaseSettings,
    clear_config_cache,
    get_database_settings,
    resolve_config_path,
    write_database_settings,
)


@dataclass(frozen=True)
class HelpContent:
    """Structured help content for CLI parsers."""

    summary: str
    description: str
    examples: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


class NoteSummary(Protocol):
    """Protocol for CLI note rendering."""

    @property
    def id(self) -> UUID: ...

    @property
    def content(self) -> str: ...

    @property
    def created_at(self) -> object | None: ...

    @property
    def deleted_at(self) -> object | None: ...


def _build_epilog(*, examples: tuple[str, ...] = (), notes: tuple[str, ...] = ()) -> str | None:
    """Build an argparse epilog from structured examples and notes."""
    sections: list[str] = []
    if examples:
        example_lines = "\n".join(f"  {example}" for example in examples)
        sections.append(f"Examples:\n{example_lines}")
    if notes:
        note_lines = "\n".join(f"  {note}" for note in notes)
        sections.append(f"Notes:\n{note_lines}")
    if not sections:
        return None
    return "\n\n".join(sections)


def _make_help_handler(parser: argparse.ArgumentParser) -> Callable[[argparse.Namespace], int]:
    """Return a handler that prints parser help for resource-level commands."""

    def _handler(_: argparse.Namespace) -> int:
        parser.print_help()
        return 0

    return _handler


def _add_documented_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
    name: str,
    *,
    help_content: HelpContent,
) -> argparse.ArgumentParser:
    """Add a parser with structured description and examples."""
    return subparsers.add_parser(
        name,
        help=help_content.summary,
        description=help_content.description,
        epilog=_build_epilog(examples=help_content.examples, notes=help_content.notes),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )


def _format_note_summary(note: NoteSummary) -> str:
    """Render a note as a single-line summary for CLI output."""
    note_id = note.id
    created_at = getattr(note, "created_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    content = getattr(note, "content", "")
    normalized_content = " ".join(str(content).split())
    if len(normalized_content) > 80:
        normalized_content = f"{normalized_content[:77]}..."
    created_label = created_at.isoformat() if created_at is not None else "-"
    status = "deleted" if deleted_at is not None else "active"
    return f"{note_id}\t{status}\t{created_label}\t{normalized_content}"


def _run_async(operation: Coroutine[object, object, int]) -> int:
    """Run an async CLI operation from the synchronous CLI entrypoint."""
    return int(asyncio.run(operation))


def _refresh_runtime_configuration() -> None:
    """Clear cached configuration and session state in the current process."""
    clear_config_cache()
    from lifeos_cli.db.session import clear_session_cache

    clear_session_cache()


def _prompt_text(label: str, *, default: str | None = None) -> str:
    """Prompt for a text value."""
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    if value:
        return value
    if default is not None:
        return default
    raise ConfigurationError(f"{label} is required")


def _prompt_bool(label: str, *, default: bool) -> bool:
    """Prompt for a yes/no value."""
    suffix = "Y/n" if default else "y/N"
    value = input(f"{label} [{suffix}]: ").strip().lower()
    if not value:
        return default
    if value in {"y", "yes"}:
        return True
    if value in {"n", "no"}:
        return False
    raise ConfigurationError(f"{label} must be answered with yes or no")


def _format_config_summary(settings: DatabaseSettings, *, show_secrets: bool = False) -> str:
    """Render effective config values for display."""
    lines = [
        f"Config file: {settings.config_file}",
        f"Database URL: {settings.render_database_url(show_secrets=show_secrets)}",
        f"Database schema: {settings.database_schema}",
        f"Database echo: {'true' if settings.database_echo else 'false'}",
    ]
    return "\n".join(lines)


def _print_database_runtime_error(exc: BaseException) -> int:
    """Render actionable database configuration or connectivity failures."""
    if isinstance(exc, ConfigurationError):
        print(str(exc), file=sys.stderr)
    else:
        settings = get_database_settings()
        print("Database operation failed.", file=sys.stderr)
        print(
            f"Configured database URL: {settings.render_database_url(show_secrets=False)}",
            file=sys.stderr,
        )
        print(f"Configured schema: {settings.database_schema}", file=sys.stderr)
        print("Run `lifeos init` to create or update local configuration.", file=sys.stderr)
        print(
            "Then run `lifeos db ping` to verify connectivity and `lifeos db upgrade` to apply "
            "migrations.",
            file=sys.stderr,
        )
        print(f"Original error: {exc}", file=sys.stderr)
    return 1


async def _handle_note_add_async(args: argparse.Namespace) -> int:
    """Create a new note."""
    from lifeos_cli.db.services import create_note
    from lifeos_cli.db.session import session_scope

    async with session_scope() as session:
        note = await create_note(session, content=args.content)
    print(f"Created note {note.id}")
    return 0


def _handle_note_add(args: argparse.Namespace) -> int:
    """Create a new note."""
    return _run_async(_handle_note_add_async(args))


async def _handle_note_list_async(args: argparse.Namespace) -> int:
    """List notes."""
    from lifeos_cli.db.services import list_notes
    from lifeos_cli.db.session import session_scope

    async with session_scope() as session:
        notes = await list_notes(
            session,
            include_deleted=args.include_deleted,
            limit=args.limit,
            offset=args.offset,
        )
    if not notes:
        print("No notes found.")
        return 0
    for note in notes:
        print(_format_note_summary(note))
    return 0


def _handle_note_list(args: argparse.Namespace) -> int:
    """List notes."""
    return _run_async(_handle_note_list_async(args))


async def _handle_note_update_async(args: argparse.Namespace) -> int:
    """Update note content."""
    from lifeos_cli.db.services import NoteNotFoundError, update_note
    from lifeos_cli.db.session import session_scope

    try:
        async with session_scope() as session:
            note = await update_note(session, note_id=args.note_id, content=args.content)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Updated note {note.id}")
    return 0


def _handle_note_update(args: argparse.Namespace) -> int:
    """Update note content."""
    return _run_async(_handle_note_update_async(args))


async def _handle_note_delete_async(args: argparse.Namespace) -> int:
    """Delete a note."""
    from lifeos_cli.db.services import NoteNotFoundError, delete_note
    from lifeos_cli.db.session import session_scope

    try:
        async with session_scope() as session:
            await delete_note(session, note_id=args.note_id, hard_delete=args.hard)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.hard:
        print(f"Deleted note {args.note_id}")
    else:
        print(f"Soft-deleted note {args.note_id}")
    return 0


def _handle_note_delete(args: argparse.Namespace) -> int:
    """Delete a note."""
    return _run_async(_handle_note_delete_async(args))


async def _handle_db_ping_async(_: argparse.Namespace) -> int:
    """Ping the configured database."""
    from lifeos_cli.db.admin import ping_database

    await ping_database()
    print("Database connection succeeded.")
    return 0


def _handle_db_ping(args: argparse.Namespace) -> int:
    """Ping the configured database."""
    return _run_async(_handle_db_ping_async(args))


def _handle_db_upgrade(_: argparse.Namespace) -> int:
    """Apply database migrations."""
    from lifeos_cli.db.admin import upgrade_database

    upgrade_database()
    print("Database migrations are up to date.")
    return 0


def _handle_config_show(args: argparse.Namespace) -> int:
    """Show the effective runtime configuration."""
    settings = get_database_settings()
    print(_format_config_summary(settings, show_secrets=args.show_secrets))
    return 0


def _build_settings_from_args(args: argparse.Namespace) -> DatabaseSettings:
    """Build settings from CLI arguments and current defaults."""
    current = get_database_settings()
    config_path = resolve_config_path()
    database_url = args.database_url or current.database_url
    database_schema = args.schema or current.database_schema
    database_echo = current.database_echo if args.echo is None else args.echo

    if not args.non_interactive and sys.stdin.isatty():
        database_url = _prompt_text(
            "Database URL",
            default=database_url,
        )
        database_schema = _prompt_text("Database schema", default=database_schema)
        database_echo = _prompt_bool("Enable SQL echo logging", default=database_echo)

    if database_url is None:
        raise ConfigurationError(
            "Database URL is required. Provide --database-url or run `lifeos init` interactively."
        )

    return DatabaseSettings(
        database_url=database_url,
        database_schema=database_schema,
        database_echo=database_echo,
        config_file=config_path,
    )


def _handle_init(args: argparse.Namespace) -> int:
    """Initialize local configuration and verify database connectivity."""
    settings = _build_settings_from_args(args)
    config_path = write_database_settings(settings)
    _refresh_runtime_configuration()

    print(f"Wrote config file: {config_path}")
    print(_format_config_summary(settings, show_secrets=False))

    if args.skip_ping:
        print("Skipped database connectivity check.")
    else:
        _run_async(_handle_db_ping_async(args))

    if args.skip_migrate:
        print("Skipped database migrations. Run `lifeos db upgrade` when ready.")
    else:
        _handle_db_upgrade(args)

    return 0


def _build_init_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the init command."""
    init_parser = _add_documented_parser(
        subparsers,
        "init",
        help_content=HelpContent(
            summary="Initialize local configuration",
            description=(
                "Create or update the local LifeOS config file and verify that the database\n"
                "is reachable.\n\n"
                "This command is the recommended first step after installing lifeos-cli."
            ),
            examples=(
                "lifeos init",
                "lifeos init --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos",
                "lifeos init --non-interactive --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos "
                "--skip-migrate",
            ),
            notes=(
                "Configuration is written to ~/.config/lifeos/config.toml by default.",
                "Environment variables still override config file values at runtime.",
                "Database credentials may be stored in plain text in the config file.",
            ),
        ),
    )
    init_parser.add_argument(
        "--database-url",
        help="PostgreSQL connection URL to persist in the config file",
    )
    init_parser.add_argument(
        "--schema",
        default=None,
        help="PostgreSQL schema name to use for application tables",
    )
    init_parser.add_argument(
        "--echo",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="Enable SQLAlchemy SQL echo logging in the config file",
    )
    init_parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Do not prompt for missing values; require flags or existing config values",
    )
    init_parser.add_argument(
        "--skip-ping",
        action="store_true",
        help="Do not check database connectivity after writing the config file",
    )
    init_parser.add_argument(
        "--skip-migrate",
        action="store_true",
        help="Do not run database migrations after writing the config file",
    )
    init_parser.set_defaults(handler=_handle_init)


def _build_config_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the config command tree."""
    config_parser = _add_documented_parser(
        subparsers,
        "config",
        help_content=HelpContent(
            summary="Inspect runtime configuration",
            description=(
                "Inspect the effective configuration resolved from the config file and\n"
                "environment variables."
            ),
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
            ),
        ),
    )
    config_parser.set_defaults(handler=_make_help_handler(config_parser))
    config_subparsers = config_parser.add_subparsers(
        dest="config_command",
        title="actions",
        metavar="action",
    )

    show_parser = _add_documented_parser(
        config_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show effective configuration",
            description="Print the effective config values used by the current process.",
            examples=("lifeos config show",),
            notes=("Database URLs hide passwords by default. Use --show-secrets when needed.",),
        ),
    )
    show_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help="Print sensitive values such as database passwords in full",
    )
    show_parser.set_defaults(handler=_handle_config_show)


def _build_db_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the database command tree."""
    db_parser = _add_documented_parser(
        subparsers,
        "db",
        help_content=HelpContent(
            summary="Run database administration commands",
            description=(
                "Inspect database connectivity and apply migrations.\n\n"
                "These commands operate on the database configured through `lifeos init`,\n"
                "the config file, or LIFEOS_* environment variables."
            ),
            examples=(
                "lifeos db ping",
                "lifeos db upgrade",
            ),
        ),
    )
    db_parser.set_defaults(handler=_make_help_handler(db_parser))
    db_subparsers = db_parser.add_subparsers(dest="db_command", title="actions", metavar="action")

    ping_parser = _add_documented_parser(
        db_subparsers,
        "ping",
        help_content=HelpContent(
            summary="Check database connectivity",
            description="Open a database connection and run a minimal health check query.",
            examples=("lifeos db ping",),
        ),
    )
    ping_parser.set_defaults(handler=_handle_db_ping)

    upgrade_parser = _add_documented_parser(
        db_subparsers,
        "upgrade",
        help_content=HelpContent(
            summary="Apply migrations",
            description="Apply Alembic migrations to the configured PostgreSQL database.",
            examples=("lifeos db upgrade",),
        ),
    )
    upgrade_parser.set_defaults(handler=_handle_db_upgrade)


def _build_note_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the note command tree."""
    note_parser = _add_documented_parser(
        subparsers,
        "note",
        help_content=HelpContent(
            summary="Capture and manage notes",
            description=(
                "Create, inspect, update, and delete note records.\n\n"
                "The note resource is the reference command family for LifeOS.\n"
                "Future resources should follow the same command grammar:\n"
                "  lifeos <resource> <action> [arguments] [options]"
            ),
            examples=(
                "lifeos init",
                'lifeos note add "Capture an idea"',
                "lifeos note list --limit 20",
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note delete 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                "Run `lifeos init` before using note commands for the first time.",
                "Resource names stay singular, such as note or timelog.",
                "Action names stay short verbs, such as add, list, update, and delete.",
                "The list command prints tab-separated columns: id, status, created_at, content.",
                "Delete performs a soft delete by default. Use --hard for permanent removal.",
            ),
        ),
    )
    note_parser.set_defaults(handler=_make_help_handler(note_parser))
    note_subparsers = note_parser.add_subparsers(
        dest="note_command",
        title="actions",
        metavar="action",
    )

    add_parser = _add_documented_parser(
        note_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a note",
            description=(
                "Create a new note from the provided content.\n\n"
                "Use this action to capture short thoughts, prompts, or raw text before\n"
                "they are linked to other domains such as tasks or people."
            ),
            examples=(
                "lifeos init",
                'lifeos note add "Capture the sprint retrospective idea"',
                'lifeos note add "Review the monthly budget assumptions"',
            ),
            notes=("Wrap content in quotes when it contains spaces.",),
        ),
    )
    add_parser.add_argument("content", help="Note content")
    add_parser.set_defaults(handler=_handle_note_add)

    list_parser = _add_documented_parser(
        note_subparsers,
        "list",
        help_content=HelpContent(
            summary="List notes",
            description=(
                "List notes in reverse creation order.\n\n"
                "The output is tab-separated and currently includes: id, status,\n"
                "created_at, and a normalized content preview."
            ),
            examples=(
                "lifeos note list",
                "lifeos note list --limit 20 --offset 20",
                "lifeos note list --include-deleted",
            ),
            notes=(
                "Use --include-deleted when reviewing soft-deleted records.",
                "Use --limit and --offset together for pagination.",
            ),
        ),
    )
    list_parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Include soft-deleted notes",
    )
    list_parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of notes to return",
    )
    list_parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Number of notes to skip before listing",
    )
    list_parser.set_defaults(handler=_handle_note_list)

    update_parser = _add_documented_parser(
        note_subparsers,
        "update",
        help_content=HelpContent(
            summary="Replace note content",
            description=(
                "Replace the full content of an existing note.\n\n"
                "This action updates the current note body in place. It does not apply\n"
                "partial patches or keep revision history yet."
            ),
            examples=(
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
            ),
        ),
    )
    update_parser.add_argument("note_id", type=UUID, help="Note identifier")
    update_parser.add_argument("content", help="Replacement note content")
    update_parser.set_defaults(handler=_handle_note_update)

    delete_parser = _add_documented_parser(
        note_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a note",
            description=(
                "Delete a note by identifier.\n\n"
                "By default the note is soft-deleted so it can remain visible in audit\n"
                "or recovery flows. Use --hard to remove it permanently."
            ),
            examples=(
                "lifeos note delete 11111111-1111-1111-1111-111111111111",
                "lifeos note delete 11111111-1111-1111-1111-111111111111 --hard",
            ),
        ),
    )
    delete_parser.add_argument("note_id", type=UUID, help="Note identifier")
    delete_parser.add_argument(
        "--hard",
        action="store_true",
        help="Permanently delete the note instead of soft-deleting it",
    )
    delete_parser.set_defaults(handler=_handle_note_delete)


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""
    parser = argparse.ArgumentParser(
        prog="lifeos",
        description=(
            "Run LifeOS resource commands from the terminal.\n\n"
            "Command grammar:\n"
            "  lifeos <resource> <action> [arguments] [options]\n\n"
            "Resources model domains such as notes, configuration, and database setup.\n"
            "Actions are short verbs that operate on records or runtime state."
        ),
        epilog=_build_epilog(
            examples=(
                "lifeos init",
                "lifeos config show",
                "lifeos db ping",
                'lifeos note add "Capture an idea"',
            ),
            notes=(
                "Keep resource names singular so new command families stay consistent.",
                "Prefer short action verbs such as add, list, update, and delete.",
                "Each resource help page should explain scope, actions, and examples.",
                "Run `lifeos init` before using database-backed resource commands.",
            ),
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {get_version()}",
    )
    subparsers = parser.add_subparsers(dest="resource", title="resources", metavar="resource")
    _build_init_parser(subparsers)
    _build_config_parser(subparsers)
    _build_db_parser(subparsers)
    _build_note_parser(subparsers)
    return parser


def get_version() -> str:
    """Return the installed distribution version when available."""
    try:
        return version("lifeos-cli")
    except PackageNotFoundError:
        return "0+unknown"


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)
    handler = getattr(args, "handler", None)
    if handler is None:
        parser.print_help()
        return 0
    try:
        return int(handler(args))
    except (ConfigurationError, SQLAlchemyError) as exc:
        return _print_database_runtime_error(exc)
    except EOFError as exc:
        print(f"Initialization aborted: {exc}", file=sys.stderr)
        return 1
