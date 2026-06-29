# LifeOS Web UI

This frontend is ported from the reference web frontend and adapted to the local
LifeOS Web API.

The intent is to preserve the source frontend page structure, density, layout,
and interaction behavior while keeping the implementation aligned with the
current local LifeOS API. The frontend lives as a first-party repository
workspace; it is not Python package payload.

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
npm ci
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8765`.

## Build

```bash
cd web
npm ci
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

Unsupported modules such as finance, food diary, cloud auth, invitations, agent
sessions, cardbox, notifications, export APIs, and sage maxims are not present in
this frontend until LifeOS exposes matching Web API capabilities. New Web
features should land with the corresponding `src/lifeos_web` API surface and
tests.
