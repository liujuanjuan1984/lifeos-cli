# lifeos-cli

Simplified Chinese: [README.zh-Hans.md](README.zh-Hans.md)

`lifeos-cli` is a CLI-first LifeOS for self-managing super individuals: human-friendly in direct
use, agent-friendly in automation, and built to hold the structured digital life data that connects
intention with reality.

## Value Proposition

Most personal systems fragment life into disconnected tools. That makes it unnecessarily hard to
understand:

- What did I intend to do?
- What actually happened?
- Where did my time and energy really go?
- Which relationships, routines, and priorities am I actually living out?

`lifeos-cli` treats those questions as one system problem. It gives structure to both sides of
life:

- intention: visions, tasks, habits, and planned events
- reality: notes, timelogs, completed habit actions, and relationship records

The goal is not just to store personal data, but to make self-management, reflection, and
automation operate on the same durable source of truth.

## Why CLI

The CLI is the shared interface. People can use it directly, and existing agents can call the same
commands without needing a separate embedded agent layer.

## Current Scope

The current system already covers the core building blocks of a LifeOS:

- notes
- areas
- tags
- people
- visions
- tasks
- habits and habit actions
- events
- timelogs

These modules already cover what matters, what is planned, what is being executed, and what
actually happened.

Cross-cutting capabilities already in place:

- a `schedule` read model that aggregates tasks, habit actions, and planned events into day and
  range views
- recurring event expansion and recurring habit cadence support, including on-demand habit-action
  materialization
- generic note associations across tasks, visions, events, people, timelogs, and tags
- persisted runtime configuration for database access plus preferences such as timezone, language,
  day boundary, week boundary, and vision experience defaults
- localized CLI help plus stable summary-table output with entity-specific primary-key headers for
  direct human use and agent consumption

## Getting Started

Install from PyPI:

```bash
uv tool install lifeos-cli
```

Initialize your local setup:

```bash
lifeos init
```

See the available command surface:

```bash
lifeos --help
```

Inspect and adjust runtime preferences:

```bash
lifeos config show
lifeos config set preferences.timezone America/Toronto
lifeos config set preferences.language zh-Hans
```

For complete CLI usage, workflows, and output conventions, see [docs/cli.md](docs/cli.md).

## Project Policies

- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security disclosure: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

For contributor setup, validation, integration tests, and dependency maintenance workflows, use
[CONTRIBUTING.md](CONTRIBUTING.md) as the canonical development guide.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
