// Query Keys Factory for TanStack Query
// This file provides a centralized way to manage query keys for all data entities
import type { UUID } from "@/types/primitive";
import type { NoteAdvancedSearchPayload } from "./notes";
import type { AggregationGranularity } from "./stats";
// Notes
export const notesKeys = {
  all: ["notes"] as const,
  lists: () => [...notesKeys.all, "list"] as const,
  list: (filters: {
    tag_id?: UUID;
    person_id?: UUID;
    task_id?: UUID;
    actual_event_id?: UUID;
    keyword?: string;
    untagged?: boolean;
    page?: number;
    size?: number;
  }) => [...notesKeys.lists(), filters] as const,
  advancedSearch: (filters: NoteAdvancedSearchPayload) =>
    [...notesKeys.all, "advanced-search", filters] as const,
  stats: () => [...notesKeys.all, "stats"] as const,
  details: () => [...notesKeys.all, "detail"] as const,
  detail: (id: UUID) => [...notesKeys.details(), id] as const,
};

// Visions
export const visionsKeys = {
  all: ["visions"] as const,
  lists: () => [...visionsKeys.all, "list"] as const,
  list: (filters: { status?: string; page?: number; size?: number }) =>
    [...visionsKeys.lists(), filters] as const,
  details: () => [...visionsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...visionsKeys.details(), id] as const,
  withTasks: (id: UUID) => [...visionsKeys.detail(id), "with-tasks"] as const,
  hierarchy: (id: UUID | null) =>
    [...visionsKeys.detail(id || ("" as UUID)), "hierarchy"] as const,
  stats: (id: UUID) => [...visionsKeys.detail(id), "stats"] as const,
};

// Tasks
import type { TaskListFilters } from "./tasks";
import type { TaskSelectorSourceFiltersNormalized } from "./taskFilters";

export const tasksKeys = {
  all: ["tasks"] as const,
  lists: () => [...tasksKeys.all, "list"] as const,
  list: (filters: TaskListFilters) => [...tasksKeys.lists(), filters] as const,
  selectorSource: (filters?: TaskSelectorSourceFiltersNormalized) =>
    [...tasksKeys.all, "selector-source", filters ?? {}] as const,
  details: () => [...tasksKeys.all, "detail"] as const,
  detail: (id: UUID) => [...tasksKeys.details(), id] as const,
  withSubtasks: (id: UUID) =>
    [...tasksKeys.detail(id), "with-subtasks"] as const,
  hierarchy: (visionId: UUID) =>
    [...tasksKeys.all, "hierarchy", visionId] as const,
  stats: (id: UUID) => [...tasksKeys.detail(id), "stats"] as const,
  events: (id: UUID) => [...tasksKeys.detail(id), "events"] as const,
};

// Persons
export const personsKeys = {
  all: ["persons"] as const,
  lists: () => [...personsKeys.all, "list"] as const,
  list: (filters: {
    page?: number;
    size?: number;
    search?: string;
    tag_filter?: string;
    tag_id?: UUID;
  }) => [...personsKeys.lists(), filters] as const,
  details: () => [...personsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...personsKeys.details(), id] as const,
  activities: (id: UUID | null) =>
    [...personsKeys.detail(id || ("" as UUID)), "activities"] as const,
  activitiesPage: (
    id: UUID | null,
    params: { page: number; size: number; type?: string | null },
  ) => [...personsKeys.activities(id), params] as const,
  anniversaries: (id: UUID) =>
    [...personsKeys.detail(id), "anniversaries"] as const,
  searchByTag: (tagName: string) =>
    [...personsKeys.all, "search-by-tag", tagName] as const,
};

// Dimensions
export const dimensionsKeys = {
  all: ["dimensions"] as const,
  lists: () => [...dimensionsKeys.all, "list"] as const,
  list: (filters: {
    include_inactive?: boolean;
    page?: number;
    size?: number;
  }) => [...dimensionsKeys.lists(), filters] as const,
  details: () => [...dimensionsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...dimensionsKeys.details(), id] as const,
  order: () => [...dimensionsKeys.all, "order"] as const,
};

// Actual Event Templates
export const actualEventTemplatesKeys = {
  all: ["actual-event-templates"] as const,
  lists: () => [...actualEventTemplatesKeys.all, "list"] as const,
  list: (filters: { limit?: number; offset?: number; order_by?: string }) =>
    [...actualEventTemplatesKeys.lists(), filters] as const,
  details: () => [...actualEventTemplatesKeys.all, "detail"] as const,
  detail: (id: UUID) => [...actualEventTemplatesKeys.details(), id] as const,
};

// Tags
export const tagsKeys = {
  all: ["tags"] as const,
  lists: () => [...tagsKeys.all, "list"] as const,
  list: (filters: {
    entity_type?: string;
    category?: string;
    page?: number;
    size?: number;
  }) => [...tagsKeys.lists(), filters] as const,
  details: () => [...tagsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...tagsKeys.details(), id] as const,
  entityTypes: () => [...tagsKeys.all, "entity-types"] as const,
  categories: (entityType: string) =>
    [...tagsKeys.all, "categories", entityType] as const,
  usage: (id: UUID) => [...tagsKeys.detail(id), "usage"] as const,
  statsBatch: (entityType: string) =>
    [...tagsKeys.all, "stats-batch", entityType] as const,
  withStats: (tagIds: UUID[]) =>
    [...tagsKeys.all, "with-stats", tagIds] as const,
};

// Stats
export const statsKeys = {
  all: ["stats"] as const,
  dailyDimensions: (filters: {
    start: string;
    end: string;
    timezone: string;
    dimension_ids?: UUID[];
  }) => [...statsKeys.all, "daily-dimensions", filters] as const,
  aggregatedDimensions: (filters: {
    granularity: AggregationGranularity;
    start: string;
    end: string;
    timezone: string;
    dimension_ids?: UUID[];
    first_day_of_week: number;
    calendar_system?: string;
  }) => [...statsKeys.all, "aggregated-dimensions", filters] as const,
  dayBreakdown: (day: string, timezone: string) =>
    [...statsKeys.all, "day-breakdown", { day, timezone }] as const,
};

// Habits
export const habitsKeys = {
  all: ["habits"] as const,
  lists: () => [...habitsKeys.all, "list"] as const,
  list: (filters: { statusFilter?: string }) =>
    [...habitsKeys.lists(), filters] as const,
  actionsByDate: (date: string) =>
    [...habitsKeys.all, "actions-by-date", date] as const,
  details: () => [...habitsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...habitsKeys.details(), id] as const,
  actions: (
    id: UUID,
    params?: {
      centerDate?: string | null;
      windowSize?: number | null;
      statusFilter?: string | null;
      page?: number | null;
      size?: number | null;
    },
  ) =>
    [
      ...habitsKeys.detail(id),
      params?.centerDate ?? null,
      params?.windowSize ?? null,
      params?.statusFilter ?? null,
      params?.page ?? null,
      params?.size ?? null,
      "actions",
    ] as const,
  stats: (id: UUID) => [...habitsKeys.detail(id), "stats"] as const,
};

// Food Entries
export const foodEntriesKeys = {
  all: ["food-entries"] as const,
  lists: () => [...foodEntriesKeys.all, "list"] as const,
  list: (filters: {
    start_date?: string;
    end_date?: string;
    meal_type?: string;
    page?: number;
    size?: number;
  }) => [...foodEntriesKeys.lists(), filters] as const,
  details: () => [...foodEntriesKeys.all, "detail"] as const,
  detail: (id: UUID) => [...foodEntriesKeys.details(), id] as const,
  dailyNutrition: (date: string) =>
    [...foodEntriesKeys.all, "daily-nutrition", date] as const,
};

// Foods (if needed)
export const foodsKeys = {
  all: ["foods"] as const,
  lists: () => [...foodsKeys.all, "list"] as const,
  list: (filters: {
    search?: string;
    common_only?: boolean;
    page?: number;
    size?: number;
  }) => [...foodsKeys.lists(), filters] as const,
  details: () => [...foodsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...foodsKeys.details(), id] as const,
};

// Finance
export const financeKeys = {
  all: ["finance"] as const,
  accountTree: (treeId?: UUID | null) =>
    [...financeKeys.all, "accounts-tree", treeId ?? "default"] as const,
  accountTrees: () => [...financeKeys.all, "account-trees"] as const,
  preferences: () => [...financeKeys.all, "preferences"] as const,
  snapshotsAll: () => [...financeKeys.all, "snapshots", "all"] as const,
  snapshots: (treeId?: UUID | null) =>
    [...financeKeys.all, "snapshots", treeId ?? "default"] as const,
  snapshotPlaceholder: (scope: string, treeId?: UUID | null) =>
    [...financeKeys.snapshots(treeId), "placeholder", scope] as const,
  snapshotDetail: (id: UUID, treeId?: UUID | null) =>
    [...financeKeys.snapshots(treeId), "detail", id] as const,
  snapshotCompare: (baseId: UUID, compareId: UUID, treeId?: UUID | null) =>
    [...financeKeys.snapshots(treeId), "compare", baseId, compareId] as const,
  latestRates: (treeId?: UUID | null) =>
    [...financeKeys.all, "latest-rates", treeId ?? "default"] as const,
  cashflowSources: (treeId?: UUID | null) =>
    [...financeKeys.all, "cashflow-sources", treeId ?? "default"] as const,
  cashflowTrees: () => [...financeKeys.all, "cashflow-trees"] as const,
  cashflowSnapshotsAll: () =>
    [...financeKeys.all, "cashflow-snapshots", "all"] as const,
  cashflowSnapshots: (treeId?: UUID | null) =>
    [...financeKeys.all, "cashflow-snapshots", treeId ?? "default"] as const,
  cashflowSnapshotPlaceholder: (scope: string, treeId?: UUID | null) =>
    [...financeKeys.cashflowSnapshots(treeId), "placeholder", scope] as const,
  cashflowSnapshotDetail: (id: UUID, treeId?: UUID | null) =>
    [...financeKeys.cashflowSnapshots(treeId), "detail", id] as const,
  billingCycleHistory: (sourceId?: UUID | null, month?: string | null) =>
    [
      ...financeKeys.all,
      "billing-history",
      sourceId ?? null,
      month ?? null,
    ] as const,
  cashflowSnapshotCompare: (
    baseId: UUID,
    compareId: UUID,
    treeId?: UUID | null,
  ) =>
    [
      ...financeKeys.cashflowSnapshots(treeId),
      "compare",
      baseId,
      compareId,
    ] as const,
  tradingPlans: () => [...financeKeys.all, "trading-plans"] as const,
  tradingPlanLists: () => [...financeKeys.tradingPlans(), "list"] as const,
  tradingPlanList: (filters?: { includeArchived?: boolean }) =>
    [...financeKeys.tradingPlanLists(), filters ?? {}] as const,
  tradingPlanDetails: () => [...financeKeys.tradingPlans(), "detail"] as const,
  tradingPlanDetail: (id: UUID) =>
    [...financeKeys.tradingPlanDetails(), id] as const,
  tradingPlanSummary: (
    id: UUID,
    params?: { currency?: string; rateMode?: string },
  ) =>
    [
      ...financeKeys.tradingPlanDetail(id),
      "summary",
      params?.currency ?? "default",
      params?.rateMode ?? "snapshot",
    ] as const,
  tradingInstruments: (planId: UUID) =>
    [...financeKeys.tradingPlanDetail(planId), "instruments"] as const,
  tradingPlanRates: (planId: UUID) =>
    [...financeKeys.tradingPlanDetail(planId), "exchange-rates"] as const,
  tradingPlaceholder: (scope: string) =>
    [...financeKeys.tradingPlans(), "placeholder", scope] as const,
  tradingEntries: (filters: Record<string, unknown>) =>
    [...financeKeys.all, "trading-entries", filters] as const,
};

// Invitations
export const invitationsKeys = {
  all: ["invitations"] as const,
  mineLists: () => [...invitationsKeys.all, "mine"] as const,
  mine: (filters?: { page?: number; size?: number }) =>
    [...invitationsKeys.mineLists(), filters ?? {}] as const,
  invitedMeLists: () => [...invitationsKeys.all, "invited-me"] as const,
  invitedMe: (filters?: { page?: number; size?: number }) =>
    [...invitationsKeys.invitedMeLists(), filters ?? {}] as const,
  lookup: (code: string) => [...invitationsKeys.all, "lookup", code] as const,
};

// Planned Events
export const plannedEventsKeys = {
  all: ["planned-events"] as const,
  lists: () => [...plannedEventsKeys.all, "list"] as const,
  list: (filters: { start?: string; end?: string; status?: string }) =>
    [...plannedEventsKeys.lists(), filters] as const,
  rawList: (filters?: { page?: number; size?: number; status?: string }) =>
    [...plannedEventsKeys.all, "raw", filters ?? {}] as const,
  byTask: (taskId: UUID, filters?: { page?: number; size?: number }) =>
    [...plannedEventsKeys.all, "by-task", taskId, filters ?? {}] as const,
  details: () => [...plannedEventsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...plannedEventsKeys.details(), id] as const,
};

// Actual Events
export const actualEventsKeys = {
  all: ["actual-events"] as const,
  lists: () => [...actualEventsKeys.all, "list"] as const,
  list: (filters: {
    start?: string;
    end?: string;
    tracking_method?: string;
    sort_order?: "asc" | "desc";
    timezone?: string;
  }) => [...actualEventsKeys.lists(), filters] as const,
  details: () => [...actualEventsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...actualEventsKeys.details(), id] as const,
  advancedSearch: (filters: {
    start_date: string;
    end_date?: string;
    dimension_id?: UUID | null;
    dimension_name?: string | null;
    description_keyword?: string | null;
    task_id?: UUID | null;
    sort_order?: "asc" | "desc";
  }) => [...actualEventsKeys.all, "advanced-search", filters] as const,
};

// Preferences
export const preferencesKeys = {
  all: ["preferences"] as const,
  details: () => [...preferencesKeys.all, "detail"] as const,
  detail: (key: string) => [...preferencesKeys.details(), key] as const,
};

// Auth
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
  profile: () => [...authKeys.all, "profile"] as const,
};

// LLM Credentials
export const llmCredentialKeys = {
  all: ["llm-credentials"] as const,
  list: () => [...llmCredentialKeys.all, "list"] as const,
};
