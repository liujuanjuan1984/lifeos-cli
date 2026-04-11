# CLI Guide

This document is a secondary overview of the current `lifeos` CLI.

Command-specific facts such as arguments, examples, constraints, and command notes must live in
`lifeos --help`, `lifeos <resource> --help`, and `lifeos <resource> <action> --help`.

Use this document for cross-command guidance only. Do not treat it as the source of truth for
resource-level command details.

## Command Grammar

The CLI follows one stable grammar:

```text
lifeos <resource> <action> [arguments] [options]
```

The public command tree prefers:

- short resource names
- short action verbs such as `add`, `list`, `show`, `update`, and `delete`
- `list` as the main query entrypoint for structured resources
- grouped namespaces such as `batch` for multi-record writes

## Documentation Model

To avoid duplicate maintenance, the documentation boundary is:

- Help is the primary command reference.
- Repository docs summarize cross-resource concepts and operating rules.
- When command behavior changes, update help first.
- Only update this file when a cross-command model, workflow, or policy changes.

Practical rule:

- If a user needs to know how to run one command correctly, that information belongs in help.

## Output Conventions

The current CLI output stays intentionally simple and scriptable.

- `list` commands print compact summary rows
- `show` commands print labeled fields
- `add` and `update` commands print short confirmation messages
- public `delete` commands report soft-delete results only

## Installation and Initialization

Install the published CLI:

```bash
uv tool install lifeos-cli
```

Initialize local configuration:

```bash
lifeos init
```

Inspect the effective runtime configuration:

```bash
lifeos config show
```

Check database connectivity and migrations:

```bash
lifeos db ping
lifeos db upgrade
```

## Runtime Preferences

The CLI persists a small set of runtime preferences:

- `timezone`
- `language`
- `day_starts_at`
- `week_starts_on`
- `vision_experience_rate_per_hour`

Time-oriented behavior follows these rules:

- `event` and `timelog` datetimes are stored in UTC-normalized form
- CLI timestamp rendering uses the configured `timezone`
- date-based queries also use the configured `day_starts_at`
- weekly habit summaries use the configured `week_starts_on`

## Resource Map

Use help as the first-stop reference for each command family:

- `lifeos area --help`
- `lifeos data --help`
- `lifeos event --help`
- `lifeos schedule --help`
- `lifeos habit --help`
- `lifeos habit-action --help`
- `lifeos tag --help`
- `lifeos people --help`
- `lifeos vision --help`
- `lifeos task --help`
- `lifeos timelog --help`
- `lifeos note --help`

Current high-level domain roles:

- `event`: planned schedule blocks
- `data`: canonical import/export, bundle backup, and batch operations
- `schedule`: aggregated day and range read model
- `timelog`: actual time records
- `habit`: recurring intention that generates dated habit actions
- `habit-action`: one dated habit execution row
- `task`: execution unit with planning-cycle and hierarchy support
- `vision`: longer-horizon outcome and experience container

## Safety Model

The public CLI is intentionally conservative.

- public `delete` commands only soft-delete records
- public `batch delete` commands also only soft-delete records
- hard delete stays outside the public CLI

This boundary should remain stable as more resources are added.

## Agent Guidance

If the caller is an agent or another automation layer:

- start from `list` to discover identifiers
- use `show` before destructive or state-changing operations
- treat help as the only authoritative command-level reference
- keep flows identifier-driven after discovery
- decide whether the record belongs to the human, the agent, or both before writing data
- keep separate `people` records when the human partner and the agent should remain distinct subjects
- use repeated `--person-id` flags on tasks, events, and timelogs to keep human-only, agent-only, and shared work separate

Example pattern:

```bash
lifeos people list
lifeos people show <person-id>
lifeos people update <person-id> --location "Montreal"
```
