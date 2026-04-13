# lifeos-cli

Simplified Chinese: [README.zh-Hans.md](README.zh-Hans.md)

```text
 _      ___   _____  _____   ___    ____
| |    |_ _| |  ___|| ____| / _ \  / ___|
| |     | |  | |_   |  _|  | | | | \___ \
| |___  | |  |  _|  | |___ | |_| |  ___) |
|_____||___| |_|    |_____| \___/  |____/
```

`lifeos-cli` is a terminal-native LifeOS for people who want one structured system for intentions,
plans, execution, reflection, and reality.

You can use it directly as a human-friendly CLI, or let any capable agent operate it through the
same command surface.

That includes Codex, OpenCode, Swival, Claude Code, Cursor, Gemini CLI, OpenClaw, or your own
custom agent runtime, as long as it can execute terminal commands and inspect command output.

## Why It Exists

Most personal systems fragment life into disconnected tools. Tasks live in one place, calendars in
another, notes somewhere else, and actual time spent disappears into scattered logs.

That makes it unnecessarily hard to answer practical questions such as:

- What did I intend to do?
- What actually happened?
- What did I spend time on?
- Which routines are real versus aspirational?
- Which people, projects, and priorities am I actually serving?

`lifeos-cli` treats those as one system problem.

It gives structure to both sides of life:

- intention: visions, tasks, habits, and planned events
- reality: notes, timelogs, completed habit actions, and relationship records

The goal is not just storage. The goal is a shared operational interface for self-management,
reflection, and automation.

## Use It Yourself Or Through Any Agent

`lifeos-cli` is designed for two equally valid workflows:

- direct human use in the terminal
- agent-mediated operation through stable CLI commands

A human can use it to inspect plans, log reality, and maintain personal context:

```bash
lifeos schedule show --date 2026-04-13
lifeos task list
lifeos note add "Capture today's key decisions"
lifeos timelog list --date 2026-04-13
```

An agent can use the same interface to discover identifiers, inspect state, and execute updates
without a separate embedded agent API.

This makes the project useful for:

- personal terminal-first self-management
- AI-assisted daily planning and reflection
- coding-agent workflows that need structured personal context
- automation pipelines that operate on durable personal data rather than ad hoc text files

## Why Agents Work Well With This CLI

The command surface is intentionally shaped to be easy for both humans and agents to consume:

- stable grammar: `lifeos <resource> <action> [arguments] [options]`
- help-first command model, with `--help` as the primary command reference
- identifier-driven discovery flows built around `list` and `show`
- compact summary output for lists and labeled output for record detail views
- entity-specific primary-key headers such as `task_id`, `vision_id`, and `event_id`
- localized help plus explicit language and time preferences
- one shared interface instead of separate human UI and agent API layers

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

Cross-cutting capabilities already in place:

- a `schedule` read model that aggregates tasks, habit actions, and planned events into day and
  range views
- recurring event expansion and recurring habit cadence support, including on-demand habit-action
  materialization
- generic note associations across tasks, visions, events, people, timelogs, and tags
- persisted runtime configuration for database access plus preferences such as timezone, language,
  day boundary, week boundary, and vision experience defaults
- localized CLI help and stable summary-table output for direct human use and agent consumption

## Getting Started

Install or upgrade from PyPI:

```bash
uv tool install --upgrade lifeos-cli
```

`lifeos-cli` currently assumes PostgreSQL as its default database backend.

Initialize your local setup:

```bash
lifeos init
```

You can run that step yourself, or ask an agent that can execute terminal commands and inspect
command output to initialize the local setup for you.

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
- Dependency update policy: a single weekly grouped version-update PR for `uv`
- Dependency health baseline: `bash ./scripts/dependency_health.sh`

For contributor setup, validation, integration tests, and dependency maintenance workflows, use
[CONTRIBUTING.md](CONTRIBUTING.md) as the canonical development guide.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
