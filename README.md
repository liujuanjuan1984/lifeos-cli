# lifeos-cli

`lifeos-cli` is the command-line package for LifeOS workflows, tools, and automation.

The project now ships a PostgreSQL-first data layer with Alembic migrations. Domain
modules will be introduced incrementally, starting from `notes`.

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

## CLI

Install the package and run:

```bash
lifeos --help
```

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
