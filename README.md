# lifeos-cli

`lifeos-cli` is a command-line personal operating system for people who want structured, durable,
and agent-friendly life data.

It is built on a simple premise: meaningful self-awareness starts with honest data. Intentions,
plans, routines, and actual time use should all be recorded as first-class objects instead of being
buried in disconnected notes and ad hoc tools.

The project borrows the LifeOS design philosophy from `Common Compass`, but it intentionally does
not include an embedded agentic layer. Instead, `lifeos-cli` treats the CLI itself as the stable
interface: humans can use it directly, and existing coding agents or automation systems can invoke
the same commands without needing a separate in-product agent runtime.

## Design Principles

- Structured data before speculative intelligence
- Clear separation between intention and reality
- PostgreSQL-first persistence with explicit schema evolution
- async-only runtime services and data access
- one CLI grammar that stays consistent across domains
- a tool surface that is easy for both humans and agents to call

## Current Domain Surface

The project is still expanding incrementally, but the current foundation already covers:

- notes
- areas
- tags
- people
- visions
- tasks
- habits and habit actions
- events for planned schedule blocks
- timelogs for actual time records

Together, these domains form the initial bridge between:

- intention: visions, tasks, habits, planned events
- reality: notes, timelogs, completed habit actions, relationship records

That bridge is the core value of the project. The goal is not just to collect data, but to make it
possible to compare what you meant to do with what you actually invested time and attention in.

## Install

Install from PyPI with `uv tool`:

```bash
uv tool install lifeos-cli
```

## Getting Started

1. Install the package:

   ```bash
   uv tool install lifeos-cli
   ```

2. Initialize local configuration:

   ```bash
   lifeos init
   ```

3. Explore the available command surface:

   ```bash
   lifeos --help
   ```

For complete CLI usage, resource-by-resource workflows, output conventions, and agent-oriented
calling patterns, see [docs/cli.md](docs/cli.md).

The public CLI only performs soft deletion. Permanent cleanup is intentionally kept out of the
user-facing command tree and must be done through internal maintenance scripts.

## Time Semantics

`lifeos-cli` stores datetimes in UTC and renders them back in the configured local timezone.

Operational day and week views are preference-aware:

- `timezone` controls local rendering
- `day_starts_at` controls when a local day begins
- `week_starts_on` controls weekly grouping

This keeps storage semantics stable while still letting the CLI reflect the user's lived time
boundaries.

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
