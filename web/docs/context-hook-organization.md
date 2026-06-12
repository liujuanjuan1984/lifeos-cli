# Context and Hook Organization

This document defines the expected placement rules for frontend contexts,
providers, consumer hooks, and page orchestration logic.

## Core Rules

1. Keep app-level shared state in `src/contexts`.
2. Define the React context object and its consumer hook in the same context
   module.
3. Keep the provider in a dedicated `*Provider.tsx` file when the provider owns
   state or effects.
4. Keep cross-feature reusable hooks in `src/hooks`.
5. Keep page orchestration, feature-local controllers, and feature-local
   contexts in `src/features/*/controller`.

## Placement Guide

### `src/contexts`

Use this for app-level state that is shared across unrelated features.

Examples:
- theme
- toast
- page header
- modal stack
- agent edit mode

Recommended structure:
- `ThemeContext.ts`
- `ThemeProvider.tsx`

The context module should export:
- context types
- the context object
- the consumer hook

The provider file should export:
- the provider component
- provider-only state and effects

### `src/hooks`

Use this for reusable hooks that are not owned by a single feature.

Examples:
- browser interaction hooks
- shared UI state helpers
- cross-feature server-state hooks
- small reusable composition hooks

Do not place app-level context consumer hooks here.

### `src/features/*/controller`

Use this for feature-local orchestration code.

Examples:
- page data assembly
- feature controller hooks
- advanced interaction coordinators
- feature-local context modules

Pages should prefer importing one or a few controller hooks from their feature
instead of composing many unrelated domain hooks inline.

## Query and Mutation Placement

Use the following rules for TanStack Query, cache invalidation, and server-state
orchestration.

### Shared query hooks in `src/hooks`

Keep query or mutation hooks in `src/hooks` only when they are shared across
multiple features or represent reusable infrastructure.

Allowed examples:
- `hooks/queries/useDimensions.ts`
- `hooks/queries/usePlanningTasks.ts`
- `hooks/useActualEventsMutations.ts`
- `hooks/useTasksMutations.ts`
- `hooks/useToastMutation.ts`
- `hooks/selectors/useTagSelectorSource.ts`

These hooks may own:
- shared query keys
- shared invalidation behavior
- shared optimistic update logic
- reusable selector-source loading

Do not keep a hook here if it mainly exists to support one page, one modal, or
one feature flow.

### Feature-local query orchestration in `src/features/*/controller`

Keep feature-owned server-state orchestration in feature controllers.

Examples:
- `features/calendar/controller/useCalendarEventsController.ts`
- `features/insights/controller/useInsightsStatsController.ts`
- `features/notes/controller/useCreateNoteModalController.ts`
- `features/tags/controller/useTagManagerController.ts`
- `features/agent/controller/useSessionContextCreateController.ts`

These hooks may own:
- multiple queries or mutations for one feature flow
- page-level or modal-level cache refresh logic
- view-model shaping for feature components
- polling, preview, or draft interaction flows

### `pages`

Pages should not directly own:
- `useQuery` or `useMutation` calls for business data
- cache invalidation flows
- multi-domain data assembly

Pages may still own:
- local presentational state
- navigation state
- pure view-state helpers such as `useQueryMode`

### `components`

Shared components should stay presentation-first.

Avoid putting feature-owned query, mutation, polling, or cache orchestration in
top-level shared components under `src/components`.

If a component needs feature-owned server-state behavior, move that behavior to
`src/features/*/controller` and pass the resulting state and handlers down.

Feature-scoped components that live under `src/features/*/components` may keep
small read-only queries when the ownership is obvious and the logic is tightly
coupled to that leaf component, but prefer a controller once the component owns
any of the following:
- more than one query or mutation
- cache invalidation
- polling or retry coordination
- cross-entity data assembly
- modal or page workflow state

## Dependency Direction

Follow this dependency direction whenever possible:

1. `contexts` can depend on shared hooks and utilities.
2. `hooks` can depend on services, utilities, and shared contexts.
3. `features/*/controller` can depend on shared hooks, shared contexts,
   services, and feature-local modules.
4. `pages` should depend on `features/*/controller`, presentational components,
   and a limited number of shared hooks.

Avoid the reverse direction:
- shared hooks depending on feature controllers
- shared contexts depending on feature-local controllers
- pages becoming the primary place where business orchestration accumulates

## Naming Rules

1. Use `*Context.ts` or `*Context.tsx` for context modules.
2. Use `*Provider.tsx` for provider components.
3. Use `use*Controller.ts` or `use*PageData.ts` inside
   `features/*/controller` when the hook is feature-local.
4. Use `use*` names in `src/hooks` only for reusable shared hooks.

## Anti-Patterns

Avoid these patterns:

1. The same concern exposing multiple import paths across `hooks` and
   `contexts`.
2. Putting a feature-local page orchestration hook in the root `src/hooks`
   directory.
3. Adding wide barrel exports that blur ownership boundaries.
4. Moving code only for symmetry when the ownership boundary stays unchanged.
5. Leaving cache invalidation or polling logic inside shared UI components.
6. Treating `pages` as the default place to combine server-state dependencies.

## Review Checklist

Use this checklist when adding or reviewing new frontend code.

1. Does this context belong to app-level shared state or to one feature only?
2. If this hook uses TanStack Query, is it shared infrastructure or
   feature-owned orchestration?
3. If this logic is only used by one page, modal, or feature flow, should it
   move into `features/*/controller`?
4. Is any shared component under `src/components` owning cache invalidation,
   polling, or multi-entity server-state composition?
5. Is the import path exposing one clear ownership boundary?

## Current Reference Examples

These modules reflect the preferred structure after the `#146` cleanup:

- App-level contexts:
  - `src/contexts/ThemeContext.ts`
  - `src/contexts/ThemeProvider.tsx`
  - `src/contexts/PageHeaderContext.ts`
  - `src/contexts/PageHeaderProvider.tsx`
- Feature controllers:
  - `src/features/timeLog/controller/useTimeLogPageData.ts`
  - `src/features/notes/controller/useNotesPageData.ts`
  - `src/features/calendar/controller/useCalendarEventsController.ts`
  - `src/features/insights/controller/useInsightsStatsController.ts`
  - `src/features/dimensions/controller/useDimensionManagerController.ts`
- Shared hooks kept at root by design:
  - `src/hooks/useActualEventsMutations.ts`
  - `src/hooks/useTasksMutations.ts`
  - `src/hooks/useToastMutation.ts`
  - `src/hooks/selectors/useTagSelectorSource.ts`
