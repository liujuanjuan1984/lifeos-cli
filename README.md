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

Initialize local configuration:

```bash
lifeos init
```

The init flow writes `~/.config/lifeos/config.toml` by default, verifies database
connectivity, and applies migrations unless you skip those steps.

Inspect the effective config:

```bash
lifeos config show
```

Environment variables still override the config file when needed:

```bash
export LIFEOS_DATABASE_URL=postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos
export LIFEOS_DATABASE_SCHEMA=lifeos
```

Database administration commands:

```bash
lifeos db ping
lifeos db upgrade
```

## CLI

Inspect the available commands:

```bash
lifeos --help
```

The command system follows a consistent grammar:

```text
lifeos <resource> <action> [arguments] [options]
```

Command design conventions on this branch:

- Resource names stay singular nouns, such as `note`
- Action names stay short verbs, such as `add`, `list`, `update`, and `delete`
- Each resource help page should explain scope, supported actions, and examples
- Future resources such as `timelog` should follow the same structure when introduced

Current branch examples:

```bash
lifeos init
lifeos config show
lifeos db ping
lifeos note add "a new note"
printf 'first line\nsecond line\n' | lifeos note add --stdin
lifeos note add --file ./note.md
lifeos note list
lifeos note show 11111111-1111-1111-1111-111111111111
lifeos note update 11111111-1111-1111-1111-111111111111 "updated content"
lifeos note delete 11111111-1111-1111-1111-111111111111
```

For multi-line note content, use `--stdin` or `--file` instead of shell-specific quoting:

```bash
cat <<'EOF' | lifeos note add --stdin
This is a multi-line note.
The second line stays intact.
EOF
```

Use `lifeos note list` for a one-line summary view. Use `lifeos note show <note-id>` when
you need the original multi-line content.

The current branch exposes a narrow first slice:

- PostgreSQL-backed note storage
- Local config initialization with `lifeos init`
- Runtime config inspection with `lifeos config show`
- Database health checks and migrations with `lifeos db ping` and `lifeos db upgrade`
- Alembic migrations
- A structured CLI family rooted in `lifeos <resource> <action>`
- `note add`, `note list`, `note show`, `note update`, and `note delete`

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
