# LifeOS Web UI

This frontend is ported from the reference web frontend and adapted to the
local LifeOS Web API.

The intent is to preserve the source frontend page structure, density, layout, and
interaction behavior, then subtract or disable modules that do not have a
corresponding LifeOS backend surface yet.

## Run With Built Assets

From the repository root:

```bash
uv run --extra web --extra postgres lifeos web serve --host 127.0.0.1 --port 8765 --static-dir web/dist
```

Use `--extra postgres` when the configured LifeOS database URL uses
`postgresql+psycopg://`. For SQLite-only local setups, `--extra web` is enough.

## Development

Run the API:

```bash
uv run --extra web --extra postgres lifeos web serve --host 127.0.0.1 --port 8765
```

Run the Vite frontend:

```bash
cd web
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8765`.

## Build

```bash
cd web
npm install
npm run build
```

## Current Scope

Default navigation keeps LifeOS-backed surfaces visible:

- Vision
- Habit
- Planning
- Timelog
- Stats
- Schedule
- Note
- People
- Config

Unsupported modules such as finance, food diary, cloud auth, invitations,
agent sessions, and sage maxims are hidden or backed by explicit empty-data
adapters until LifeOS exposes matching Web API capabilities.
