# lifeos-cli

`lifeos-cli` is the command-line package for LifeOS workflows, tools, and automation.

The project now ships a PostgreSQL-first data layer with Alembic migrations. Domain
modules will be introduced incrementally, starting from `notes`.
The runtime service and data layers are async-only, while the CLI remains a thin wrapper.

## Install

Install from PyPI with `uv tool`:

```bash
uv tool install lifeos-cli
```

Run without a persistent installation:

```bash
uv tool run --from lifeos-cli lifeos --help
```

## Development

1. Install `uv`.
2. Sync the development environment:

   ```bash
   uv sync --all-extras
   ```

3. Run the default validation entrypoint:

   ```bash
   bash ./scripts/doctor.sh
   ```

## Database

Default environment variables:

```bash
export LIFEOS_DATABASE_URL=postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos
export LIFEOS_DATABASE_SCHEMA=lifeos
```

Apply migrations:

```bash
uv run alembic upgrade head
```

The current branch assumes the database schema is prepared before running note commands.

## CLI

Inspect the available commands:

```bash
lifeos --help
```

Current branch examples:

```bash
lifeos note add "a new note"
lifeos note list
lifeos note update 11111111-1111-1111-1111-111111111111 "updated content"
lifeos note delete 11111111-1111-1111-1111-111111111111
```

The current branch exposes a narrow first slice:

- PostgreSQL-backed note storage
- Alembic migrations
- `note add`, `note list`, `note update`, and `note delete`

Not implemented yet on this branch:

- tags for notes
- note-to-task or note-to-person associations
- note ingestion jobs or search workflows

## Tooling

- `pre-commit` is used for local quality gates.
- `pip-audit` is used for dependency vulnerability checks.
- GitHub Actions validates pull requests, audits dependencies, and prepares release publishing on version tags.

## Project Policies

- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security disclosure: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
