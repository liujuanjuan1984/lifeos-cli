# lifeos-cli

[简体中文版](README.zh-Hans.md)

```text
██╗     ██╗███████╗███████╗ ██████╗ ███████╗
██║     ██║██╔════╝██╔════╝██╔═══██╗██╔════╝
██║     ██║█████╗  █████╗  ██║   ██║███████╗
██║     ██║██╔══╝  ██╔══╝  ██║   ██║╚════██║
███████╗██║██║     ███████╗╚██████╔╝███████║
╚══════╝╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚══════╝
```

`lifeos-cli` is a terminal-native LifeOS for people who want one structured system for intentions, plans, execution, reflection, and reality.

## Why It Exists

Most personal systems fragment life into disconnected tools. Tasks live in one place, calendars in another, notes somewhere else, and actual time spent disappears into scattered logs.

That makes it unnecessarily hard to answer practical questions such as:

- What did I intend to do?
- What actually happened?
- What did I spend time on?
- Which routines are real versus aspirational?
- Which people, projects, and priorities am I actually serving?

It gives structure to both sides of life:

- intention: visions, tasks, habits, and planned events
- reality: notes, timelogs, completed habit actions, and relationship records

The goal is not just storage, but one CLI interface for self-management, reflection, and automation.

## Getting Started

Install or upgrade from PyPI:

```bash
uv tool install --upgrade lifeos-cli
```

Install PostgreSQL support only when you need it:

```bash
uv tool install --upgrade "lifeos-cli[postgres]"
```

`lifeos-cli` supports both SQLite and PostgreSQL.

- SQLite is the low-friction option for local, single-user setups.
- PostgreSQL remains the schema-capable backend for managed deployments.

Initialize your local setup:

```bash
lifeos init
```

For local-first use, `lifeos init` can bootstrap SQLite without requiring a separate database service. Use `lifeos init --help` for backend-specific defaults and examples.

You can run that step yourself, or ask an agent that can run terminal commands to do it for you.

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

Common commands:

```bash
lifeos schedule show --date 2026-04-13
lifeos task list
lifeos note add "Capture today's key decisions"
lifeos timelog list --date 2026-04-13
```

For complete CLI usage, workflows, and output conventions, see [docs/cli.md](docs/cli.md).

## Agent Use (Recommended)

Any agent runtime that can execute terminal commands and inspect command output can operate the same CLI. That includes Codex, OpenCode, Swival, Claude Code, Cursor, Gemini CLI, OpenClaw, or your own setup.

- stable grammar: `lifeos <resource> <action> [arguments] [options]`
- help-first command model, with `--help` as the primary command reference
- identifier-driven discovery flows built around `list` and `show`
- compact summary output for lists and labeled output for record detail views
- entity-specific primary-key headers such as `task_id`, `vision_id`, and `event_id`

## Current Scope

The current system already covers the core building blocks of a practical LifeOS:

- notes
- areas
- tags
- people
- visions
- tasks
- habits and habit actions
- events
- timelogs

Cross-cutting capabilities:

- a `schedule` read model that aggregates tasks, habit actions, and planned events into day and range views
- recurring event expansion and recurring habit cadence support, including on-demand habit-action materialization
- generic note associations across tasks, visions, events, people, timelogs, and tags
- persisted runtime configuration for database access plus preferences such as timezone, language, day boundary, week boundary, and vision experience defaults
- localized CLI help and stable summary-table output for direct human use and agent consumption

## Project Policies

- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security disclosure: [SECURITY.md](SECURITY.md)
- Community expectations: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
