# CLI Guide

This document describes the current `lifeos` command structure exposed by the branch.
It is intended for both human operators and agents that need stable command patterns.

## Command Grammar

The CLI follows a consistent grammar:

```text
lifeos <resource> <action> [arguments] [options]
```

Command design conventions:

- resource names stay short and stable; most are singular nouns such as `note` or `task`
- use natural exceptions such as `people` when they are clearer than forced regular forms
- action names stay short verbs, such as `add`, `list`, `show`, `search`, and `delete`
- when one command targets multiple records, it should live under a grouped namespace such as
  `batch`
- for structured resources, `list` is the primary query entrypoint and should grow richer filters
  over time
- the public CLI only performs soft deletion; permanent cleanup is reserved for internal
  maintenance scripts

## Operating Model

The CLI is designed around a few stable patterns:

- create a record with `add`
- inspect collections with `list`
- inspect one record with `show`
- mutate one record with `update`
- soft-delete records with `delete`
- group multi-record write operations under `batch`

For structured resources such as `area`, `tag`, `people`, `vision`, `task`, `event`, and `timelog`:

- prefer `list` as the main query command
- expect future filtering and pagination growth on `list`
- do not expect a separate public `search` command yet

For text-heavy resources such as `note`:

- `search` exists because it is a distinct retrieval mode
- `show` is the correct way to inspect full multi-line content

## Output Conventions

The current CLI output is intentionally simple and scriptable.

- `list` commands print tab-separated summary rows
- `show` commands print labeled detail fields
- `add` and `update` commands print a short confirmation plus the resulting identifier
- `delete` and `batch delete` commands print soft-delete results only

Practical guidance:

- use `list` when a human or agent needs compact summaries
- use `show` when exact field values or multi-line content matter
- keep identifiers from `add` or `list` output and feed them into later commands
- do not assume `list` output preserves multi-line formatting; use `show` for that

## Installation and Initialization

Install the published CLI:

```bash
uv tool install lifeos-cli
```

Initialize local configuration and database access:

```bash
lifeos init
```

Initialize while persisting user preferences:

```bash
lifeos init --timezone America/Toronto --language zh-Hans --day-starts-at 04:00 --week-starts-on sunday
```

Inspect the effective configuration:

```bash
lifeos config show
```

Check database connectivity and apply migrations:

```bash
lifeos db ping
lifeos db upgrade
```

Recommended first-run flow:

```bash
lifeos init
lifeos db ping
lifeos db upgrade
```

Current persisted preference keys:

- `timezone`: default IANA timezone used for future local day boundaries and time-based summaries
- `language`: preferred language tag such as `en`, `en-CA`, or `zh-Hans`
- `day_starts_at`: local day boundary in `HH:MM`
- `week_starts_on`: preferred first day of the week (`monday` or `sunday`)

## Notes

Create a note from inline content:

```bash
lifeos note add "a new note"
```

Create a multi-line note from standard input:

```bash
cat <<'EOF' | lifeos note add --stdin
This is a multi-line note.
The second line stays intact.
EOF
```

Create a note from a file:

```bash
lifeos note add --file ./note.md
```

List notes:

```bash
lifeos note list
lifeos note list --limit 20 --offset 20
lifeos note list --include-deleted
```

Show the full note body with preserved line breaks:

```bash
lifeos note show 11111111-1111-1111-1111-111111111111
```

Update or delete a note:

```bash
lifeos note update 11111111-1111-1111-1111-111111111111 "updated content"
lifeos note delete 11111111-1111-1111-1111-111111111111
```

Minimal note workflow:

```bash
lifeos note add "capture an idea"
lifeos note list
lifeos note show <note-id>
lifeos note update <note-id> "capture a better idea"
lifeos note delete <note-id>
```

## Note Search

Search currently uses PostgreSQL-backed `ILIKE` token matching against note content.

```bash
lifeos note search "meeting notes"
lifeos note search "budget q2" --limit 20
lifeos note search "archived idea" --include-deleted
```

Current behavior:

- multi-word queries are split into tokens
- tokens are matched with OR semantics
- results use the same summary format as `lifeos note list`

## Core Domains

The branch now exposes early CRUD-oriented command families for several additional domains:

- `lifeos area ...`
- `lifeos event ...`
- `lifeos habit ...`
- `lifeos habit-action ...`
- `lifeos tag ...`
- `lifeos people ...`
- `lifeos task ...`
- `lifeos timelog ...`
- `lifeos vision ...`

Examples:

```bash
lifeos area add "Health"
lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00
lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21
lifeos habit-action list --action-date 2026-04-09
lifeos tag add "family" --entity-type person --category relation
lifeos people add "Alice" --nickname ally --location Toronto
lifeos vision add "Launch lifeos-cli"
lifeos task add "Draft release checklist" --vision-id <vision-id>
lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 --end-time 2026-04-10T14:30:00-04:00
lifeos task batch delete --ids <task-id-1> <task-id-2>
```

Current intent:

- `list` is the query entrypoint for these structured resources
- standalone `search` is intentionally deferred for now
- `batch` is the grouped namespace for multi-record write operations
- `habit-action` is a top-level resource instead of a nested `habit action` command tree
- repeated `--person-id` flags attach people to supported resources such as `area`, `tag`,
  `vision`, `task`, `event`, and `timelog`

## Structured Resource Workflows

These examples show the current intended command shape for the new structured resources.

### Area

```bash
lifeos area add "Health" --description "Long-term wellbeing" --icon heart
lifeos area update <area-id> --person-id <person-id-1> --person-id <person-id-2>
lifeos area list --person-id <person-id>
lifeos area list
lifeos area show <area-id>
lifeos area update <area-id> --name "Fitness" --clear-icon
lifeos area delete <area-id>
```

### Tag

```bash
lifeos tag add "family" --entity-type person --category relation --color green
lifeos tag update <tag-id> --person-id <person-id>
lifeos tag list --person-id <person-id>
lifeos tag list
lifeos tag show <tag-id>
lifeos tag update <tag-id> --clear-color
lifeos tag delete <tag-id>
```

### Event

```bash
lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00
lifeos event list --window-start 2026-04-10T00:00:00-04:00 --window-end 2026-04-10T23:59:59-04:00
lifeos event show <event-id>
lifeos event update <event-id> --status completed --clear-task
lifeos event delete <event-id>
```

Current event notes:

- `event` is the planned schedule object, not the todo object
- use `--window-start` and `--window-end` to query overlapping calendar ranges
- use repeated `--tag-id` and `--person-id` flags to attach tags and people

### Habit

```bash
lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21
lifeos habit list --with-stats
lifeos habit show <habit-id>
lifeos habit update <habit-id> --status paused
lifeos habit stats <habit-id>
lifeos habit task-associations
lifeos habit delete <habit-id>
```

Current habit notes:

- a habit generates one dated `habit-action` row per day in its duration
- updating start dates or duration automatically reconciles generated action rows
- habit deletion is soft deletion only in the public CLI

### Habit Action

```bash
lifeos habit-action list --habit-id <habit-id>
lifeos habit-action list --action-date 2026-04-09
lifeos habit-action show <action-id>
lifeos habit-action update <action-id> --status done
lifeos habit-action update <action-id> --clear-notes
```

Current habit-action notes:

- public CLI does not create or delete habit actions directly
- use `list` for both per-habit and by-date inspection flows
- updates respect the habit-action editable window enforced by the service layer

### People

```bash
lifeos people add "Alice" --nickname ally --location Toronto
lifeos people list
lifeos people show <person-id>
lifeos people update <person-id> --clear-location
lifeos people delete <person-id>
```

### Vision

```bash
lifeos vision add "Launch lifeos-cli" --area-id <area-id> --status active
lifeos vision update <vision-id> --person-id <person-id-1> --person-id <person-id-2>
lifeos vision list --person-id <person-id>
lifeos vision list --status active
lifeos vision show <vision-id>
lifeos vision update <vision-id> --status archived --clear-area
lifeos vision delete <vision-id>
```

### Task

```bash
lifeos task add "Draft release checklist" --vision-id <vision-id> --status todo
lifeos task update <task-id> --person-id <person-id>
lifeos task list --person-id <person-id>
lifeos task list --vision-id <vision-id>
lifeos task show <task-id>
lifeos task update <task-id> --status in_progress
lifeos task update <child-task-id> --clear-parent
lifeos task delete <task-id>
```

Current task notes:

- `task` is the execution unit and supports tree structure through parent-child links
- use `--clear-parent` to move a child task back to the root level
- repeated `--person-id` flags link a task to one or more people without changing its place in
  the task tree
- use `--clear-*` flags when a field should become empty instead of being replaced

### Timelog

```bash
lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 --end-time 2026-04-10T14:30:00-04:00
lifeos timelog list --window-start 2026-04-10T00:00:00-04:00 --window-end 2026-04-10T23:59:59-04:00
lifeos timelog show <timelog-id>
lifeos timelog update <timelog-id> --notes "Felt strong" --clear-task
lifeos timelog delete <timelog-id>
```

Current timelog notes:

- `timelog` is the actual time record and represents what really happened
- use repeated `--tag-id` and `--person-id` flags to attach tags and people
- timelog end time is currently required because the record models completed time spent

## Note Batch Operations

The first grouped bulk namespace is `lifeos note batch`.

Bulk content find/replace:

```bash
lifeos note batch update-content --ids \
  11111111-1111-1111-1111-111111111111 \
  22222222-2222-2222-2222-222222222222 \
  --find-text "draft" \
  --replace-text "final"
```

Bulk delete:

```bash
lifeos note batch delete --ids \
  11111111-1111-1111-1111-111111111111 \
  22222222-2222-2222-2222-222222222222
```

Internal maintenance purge:

```bash
uv run python scripts/purge_deleted_records.py note \
  --ids \
  11111111-1111-1111-1111-111111111111 \
  22222222-2222-2222-2222-222222222222 \
  --confirm permanently-delete-soft-deleted-records
```

Structured resources also expose batch soft delete:

```bash
lifeos area batch delete --ids <area-id-1> <area-id-2>
lifeos event batch delete --ids <event-id-1> <event-id-2>
lifeos tag batch delete --ids <tag-id-1> <tag-id-2>
lifeos people batch delete --ids <person-id-1> <person-id-2>
lifeos vision batch delete --ids <vision-id-1> <vision-id-2>
lifeos task batch delete --ids <task-id-1> <task-id-2>
lifeos timelog batch delete --ids <timelog-id-1> <timelog-id-2>
```

## Agent Usage Patterns

If the caller is an agent or another automation layer, prefer these patterns:

- start from `list` to discover identifiers
- switch to `show` before making a destructive or state-changing update
- treat all public `delete` commands as soft delete only
- use `batch delete` for coordinated cleanup instead of issuing many single deletes
- keep command flows id-driven instead of name-driven after discovery

Example pattern:

```bash
lifeos people list
lifeos people show <person-id>
lifeos people update <person-id> --location "Montreal"
```

## Safety Model

The public CLI is intentionally conservative:

- public `delete` commands only soft-delete records
- public `batch delete` commands also only soft-delete records
- public CLI commands do not expose hard delete
- permanent cleanup requires internal maintenance scripts and explicit confirmation text

This separation is intentional and should remain stable as more domains are added.

## Scope on This Branch

Currently implemented:

- `lifeos init`
- `lifeos config show`
- `lifeos db ping`
- `lifeos db upgrade`
- `lifeos area add|list|show|update|delete`
- `lifeos area batch delete`
- `lifeos event add|list|show|update|delete`
- `lifeos event batch delete`
- `lifeos tag add|list|show|update|delete`
- `lifeos tag batch delete`
- `lifeos people add|list|show|update|delete`
- `lifeos people batch delete`
- `lifeos vision add|list|show|update|delete`
- `lifeos vision batch delete`
- `lifeos task add|list|show|update|delete`
- `lifeos task batch delete`
- `lifeos timelog add|list|show|update|delete`
- `lifeos timelog batch delete`
- `lifeos note add`
- `lifeos note list`
- `lifeos note search`
- `lifeos note show`
- `lifeos note update`
- `lifeos note delete`
- `lifeos note batch update-content`
- `lifeos note batch delete`

Not implemented yet:

- note tags
- note-to-task or note-to-person associations
- vision experience workflows and advanced task-tree operations
- batch update operations for the new structured resources
- event/timelog recurrence or direct event-to-timelog conversion
- note ingestion jobs
- richer search ranking or association-aware note search
- public CLI access to hard delete
