# CLI Guide

This document describes the current `lifeos` command structure exposed by the branch.

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

## Installation and Initialization

Install the published CLI:

```bash
uv tool install lifeos-cli
```

Initialize local configuration and database access:

```bash
lifeos init
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
lifeos note delete 11111111-1111-1111-1111-111111111111 --hard
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
- `lifeos tag ...`
- `lifeos people ...`
- `lifeos vision ...`
- `lifeos task ...`

Examples:

```bash
lifeos area add "Health"
lifeos tag add "family" --entity-type person --category relation
lifeos people add "Alice" --nickname ally --location Toronto
lifeos vision add "Launch lifeos-cli"
lifeos task add "Draft release checklist" --vision-id <vision-id>
```

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

Permanent bulk delete:

```bash
lifeos note batch delete --ids \
  11111111-1111-1111-1111-111111111111 \
  22222222-2222-2222-2222-222222222222 \
  --hard
```

## Scope on This Branch

Currently implemented:

- `lifeos init`
- `lifeos config show`
- `lifeos db ping`
- `lifeos db upgrade`
- `lifeos area add|list|show|update|delete`
- `lifeos tag add|list|show|update|delete`
- `lifeos people add|list|show|update|delete`
- `lifeos vision add|list|show|update|delete`
- `lifeos task add|list|show|update|delete`
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
- person-to-vision or person-to-task links
- vision experience workflows and advanced task-tree operations
- note ingestion jobs
- richer search ranking or association-aware note search
