# lifeos-cli

`lifeos-cli` is the command-line package for building a personal operating system on top of
PostgreSQL, async services, and incremental domain modules.

The project is currently focused on establishing a durable foundation instead of exposing every
future LifeOS capability at once:

- PostgreSQL-first persistence
- Alembic-based schema evolution
- async-only runtime service and data layers
- a structured CLI grammar that can scale across domains
- a first end-to-end `notes` slice

## Current Focus

This branch intentionally keeps the domain surface narrow while the platform foundation settles.
Today the primary delivered slice is:

- local configuration bootstrap with `lifeos init`
- database connectivity checks and migrations
- note capture, listing, search, inspection, and batch editing
- initial `area`, `tag`, `people`, `vision`, and `task` domain foundations
- planned schedule `event` workflows
- actual time-record `timelog` workflows
- full `habit` and `habit-action` foundations with generated daily action records

## Install

Install from PyPI with `uv tool`:

```bash
uv tool install lifeos-cli
```

## Quick Start

1. Initialize local configuration:

   ```bash
   lifeos init
   ```

2. Add a note:

   ```bash
   lifeos note add "hello"
   ```

3. List notes:

   ```bash
   lifeos note list
   ```

4. Create an area, a vision, and a task:

   ```bash
   lifeos area add "Health"
   lifeos vision add "Launch lifeos-cli"
   lifeos task add "Draft release checklist" --vision-id <vision-id>
   ```

5. Create an event and a timelog:

   ```bash
   lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00
   lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 --end-time 2026-04-10T14:30:00-04:00
   ```

6. Create and inspect a habit:

   ```bash
   lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21
   lifeos habit list --with-stats
   lifeos habit-action list --action-date 2026-04-09
   ```

7. Run a batch delete operation when needed:

   ```bash
   lifeos task batch delete --ids <task-id-1> <task-id-2>
   ```

For detailed CLI usage, command grammar, multiline note input, search, and batch operations, see
[docs/cli.md](docs/cli.md).

The public CLI only performs soft deletion. Permanent cleanup is intentionally kept out of the
user-facing command tree and must be done through internal maintenance scripts.

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

## Tooling

- `pre-commit` is used for local quality gates.
- `pip-audit` is used for dependency vulnerability checks.
- GitHub Actions validates pull requests, audits dependencies, and prepares release publishing on
  version tags.

## Project Policies

- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security disclosure: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
