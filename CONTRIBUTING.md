# Contributing

Thanks for contributing to `lifeos-cli`.

This repository ships the `lifeos-cli` distribution and the `lifeos` command-line entrypoint. Changes should keep package metadata, CLI behavior, CI, security expectations, and release workflows aligned.

## Before You Start

- Read [README.md](README.md) for project scope and local development commands.
- Read [SECURITY.md](SECURITY.md) before changing publishing, credentials, or dependency handling.
- Read [AGENTS.md](AGENTS.md) if you are contributing through an automated coding workflow.

## Development Setup

Requirements:

- Python 3.10, 3.11, 3.12, or 3.13
- `uv`

Install dependencies:

```bash
uv sync --all-extras
```

## Validation

Run the default validation baseline before opening a PR:

```bash
bash ./scripts/doctor.sh
```

The default validation baseline includes dead-code scanning through `vulture`.
It runs the default non-integration test suite directly and then calls
`bash ./scripts/integration_tests.sh` as the explicit PostgreSQL-backed integration entrypoint.

If you change CI, packaging metadata, or compatibility declarations, also validate the relevant interpreter targets explicitly. Examples:

```bash
rm -rf .venv && uv sync --all-extras --python 3.10 --frozen && .venv/bin/python -m pytest
rm -rf .venv && uv sync --all-extras --python 3.11 --frozen && .venv/bin/python -m pytest
rm -rf .venv && uv sync --all-extras --python 3.12 --frozen && .venv/bin/python -m pytest
rm -rf .venv && uv sync --all-extras --python 3.13 --frozen && bash ./scripts/doctor.sh
```

To run the real CLI integration suite locally:

```bash
LIFEOS_TEST_DATABASE_URL=postgresql+psycopg://postgres:<password>@127.0.0.1:5432/lifeos_test \
bash ./scripts/integration_tests.sh
```

If you change dependency or release workflows, also run:

```bash
bash ./scripts/dependency_health.sh
uv export --format requirements.txt --no-dev --locked --no-emit-project --output-file /tmp/runtime-requirements.txt >/dev/null
uv run pip-audit --requirement /tmp/runtime-requirements.txt
rm -rf build dist && uv build --no-sources
```

Dependency maintenance policy:

- `.github/dependabot.yml` opens a single weekly grouped version-update PR for `uv`.
- `bash ./scripts/dependency_health.sh` remains the explicit maintainer audit flow for outdated
  packages and dependency-related health checks.

Static-analysis governance:

- Treat framework-driven symbols as intentional API surface when they are required by the toolchain.
  Examples in this repository include Alembic revision metadata, pytest fixtures and `pytestmark`,
  SQLAlchemy declarative hooks, and gettext extraction constants.
- Do not delete those symbols just to satisfy a generic dead-code scanner.
- Keep intentional false positives documented in `scripts/vulture_whitelist.py`.
- If you add a new framework-driven symbol that `vulture` cannot resolve, update the whitelist in
  the same change.

## Change Expectations

- Keep code, comments, commit messages, and canonical repository docs in English.
- Localized Markdown companions are allowed when the English source stays canonical, the documents
  are cross-linked, and the localized copy is updated together with the source.
- Keep issue and PR collaboration in Simplified Chinese for this repository.
- Prefer explicit, additive changes over hidden behavioral shifts.
- Keep Python compatibility declarations, CI matrices, and packaging metadata consistent with each other.
- Treat release and trusted publishing changes as security-sensitive infrastructure work.

## Git and PR Workflow

- Branch from the latest `main`.
- Use `git fetch` and `git merge --ff-only` to sync from `main`.
- Do not push directly to protected branches.
- Create or link a tracking issue for substantive development work.
- Use English commit-message style for PR titles.
- Link relevant issues in the PR description using `Closes #xx` or `Related #xx`.

## Documentation

Update docs together with code whenever you change:

- supported Python versions
- validation or dependency workflows
- release or publishing behavior
- security or disclosure guidance

Documentation language policy:

- Keep `README.md` as the canonical English entry document.
- Localized entry documents such as `README.zh-Hans.md` are allowed when they clearly link to the
  canonical English version and the English version links back to them.
- Avoid duplicating command-level facts in repository docs across languages. CLI help remains the
  primary command reference.

For CLI-facing changes:

- Treat CLI help as the primary command reference.
- Update `lifeos --help`, `lifeos <resource> --help`, or `lifeos <resource> <action> --help` when command behavior, examples, arguments, or constraints change.
- Keep repository CLI docs focused on cross-command guidance rather than duplicating command-level facts.
- Review and update the related CLI tests so help text and user-visible behavior stay covered together.
