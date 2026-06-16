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
    timelog_id?: UUID;
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
  timelogs: (id: UUID) => [...tasksKeys.detail(id), "timelogs"] as const,
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

// Areas
export const areasKeys = {
  all: ["areas"] as const,
  lists: () => [...areasKeys.all, "list"] as const,
  list: (filters: {
    include_inactive?: boolean;
    page?: number;
    size?: number;
  }) => [...areasKeys.lists(), filters] as const,
  details: () => [...areasKeys.all, "detail"] as const,
  detail: (id: UUID) => [...areasKeys.details(), id] as const,
  order: () => [...areasKeys.all, "order"] as const,
};

// Timelog Templates
export const timelogTemplatesKeys = {
  all: ["timelog-templates"] as const,
  lists: () => [...timelogTemplatesKeys.all, "list"] as const,
  list: (filters: { limit?: number; offset?: number; order_by?: string }) =>
    [...timelogTemplatesKeys.lists(), filters] as const,
  details: () => [...timelogTemplatesKeys.all, "detail"] as const,
  detail: (id: UUID) => [...timelogTemplatesKeys.details(), id] as const,
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
  dailyAreas: (filters: {
    start: string;
    end: string;
    timezone: string;
    area_ids?: UUID[];
  }) => [...statsKeys.all, "daily-areas", filters] as const,
  aggregatedAreas: (filters: {
    granularity: AggregationGranularity;
    start: string;
    end: string;
    timezone: string;
    area_ids?: UUID[];
    first_day_of_week: number;
    calendar_system?: string;
  }) => [...statsKeys.all, "aggregated-areas", filters] as const,
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

// Timelogs
export const timelogsKeys = {
  all: ["timelogs"] as const,
  lists: () => [...timelogsKeys.all, "list"] as const,
  list: (filters: {
    start?: string;
    end?: string;
    tracking_method?: string;
    sort_order?: "asc" | "desc";
    timezone?: string;
  }) => [...timelogsKeys.lists(), filters] as const,
  details: () => [...timelogsKeys.all, "detail"] as const,
  detail: (id: UUID) => [...timelogsKeys.details(), id] as const,
  advancedSearch: (filters: {
    start_date: string;
    end_date?: string;
    area_id?: UUID | null;
    without_area?: boolean;
    area_name?: string | null;
    description_keyword?: string | null;
    task_id?: UUID | null;
    sort_order?: "asc" | "desc";
  }) => [...timelogsKeys.all, "advanced-search", filters] as const,
};

// Preferences
export const preferencesKeys = {
  all: ["preferences"] as const,
  details: () => [...preferencesKeys.all, "detail"] as const,
  detail: (key: string) => [...preferencesKeys.details(), key] as const,
};
