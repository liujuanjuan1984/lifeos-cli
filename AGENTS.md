# AGENTS.md

The following rules apply to coding agent collaboration in this repository. These complement the general [CONTRIBUTING.md](CONTRIBUTING.md) workflow.

## 1. Core Principles

- Keep repository governance, release safety, and Python compatibility aligned.
- Prefer small, traceable changes that preserve a releasable `main` branch.

## 2. Collaboration Workflow

- Follow the Git, Issue, and PR workflow defined in [CONTRIBUTING.md](CONTRIBUTING.md).
- Use `gh` CLI for all issue and PR operations. Do not edit through the web UI.
- Create a new tracking issue for any development task that does not already have one.
- Link the relevant issue in the PR description with `Closes #xx` or `Related #xx` as appropriate.
- Keep issue and PR status synchronized when work scope changes.

## 3. Text and Language Conventions

- Use Simplified Chinese for issues, PR descriptions, comments, and review notes.
- Use English for repository files, code, comments, commit messages, and Markdown documentation stored in the repository.
- For multi-line PR bodies or comments, write to a temporary file first and pass it through `gh`.

## 4. Validation and Release Safety

- Use the primary validation entrypoint for code changes:
  ```bash
  bash ./scripts/doctor.sh
  ```
- If changes affect compatibility claims, packaging metadata, or CI, validate the impacted Python versions explicitly.
- Keep release-related changes aligned with:
  - [pyproject.toml](pyproject.toml)
  - [.github/workflows/validate.yml](.github/workflows/validate.yml)
  - [.github/workflows/publish.yml](.github/workflows/publish.yml)
- Do not weaken checks that protect trusted publishing, locked dependency resolution, or tag/version consistency without explicit justification.

## 5. Security and Documentation

- Never commit secrets, tokens, private keys, or `.env` contents.
- Ensure logs and examples do not expose credentials or sensitive local paths unintentionally.
- Update [SECURITY.md](SECURITY.md), [README.md](README.md), and release-related docs when changing publishing, dependency, or security-sensitive behavior.

## 6. CLI Help and Tests

- Treat CLI help as the primary command reference:
  - `lifeos --help`
  - `lifeos <resource> --help`
  - `lifeos <resource> <action> --help`
- Command-specific facts such as examples, argument constraints, behavioral notes, and scope rules must be updated in help when CLI behavior changes.
- Repository-level CLI docs should summarize cross-command concepts and must not become a second source of truth for command-level details.
- For CLI feature work, review the related help text and tests before considering the task complete.
- Do not ship CLI behavior changes with source-only updates; update the relevant help text and add or adjust tests that cover the user-visible command shape and behavior.
