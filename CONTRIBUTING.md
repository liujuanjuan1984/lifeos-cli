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

If you change CI, packaging metadata, or compatibility declarations, also validate the relevant interpreter targets explicitly. Examples:

```bash
rm -rf .venv && uv sync --all-extras --python 3.10 --frozen && .venv/bin/python -m pytest
rm -rf .venv && uv sync --all-extras --python 3.11 --frozen && .venv/bin/python -m pytest
rm -rf .venv && uv sync --all-extras --python 3.12 --frozen && .venv/bin/python -m pytest
rm -rf .venv && uv sync --all-extras --python 3.13 --frozen && bash ./scripts/doctor.sh
```

If you change dependency or release workflows, also run:

```bash
bash ./scripts/dependency_health.sh
uv export --format requirements.txt --no-dev --locked --no-emit-project --output-file /tmp/runtime-requirements.txt >/dev/null
uv run pip-audit --requirement /tmp/runtime-requirements.txt
rm -rf build dist && uv build --no-sources
```

## Change Expectations

- Keep code, comments, commit messages, and repository docs in English.
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
