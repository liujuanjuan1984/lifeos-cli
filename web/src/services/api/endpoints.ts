const API_V1 = "/api/v1";

export const ENDPOINTS = {
  TAGS: {
    BASE: `${API_V1}/tags/`,
    BY_ID: (id: string) => `${API_V1}/tags/${id}`,
    BATCH_UPDATE: `${API_V1}/tags/batch-update`,
    ENTITY_TYPES: `${API_V1}/tags/entity-types/`,
    CATEGORIES: `${API_V1}/tags/categories/`,
    CATEGORY_BY_VALUE: (value: string) =>
      `${API_V1}/tags/categories/${encodeURIComponent(value)}`,
    USAGE: (id: string) => `${API_V1}/tags/${id}/usage`,
  },
  VISIONS: {
    BASE: `${API_V1}/visions/`,
    BY_ID: (id: string) => `${API_V1}/visions/${id}`,
    WITH_TASKS: (id: string) => `${API_V1}/visions/${id}/with-tasks`,
    ADD_EXPERIENCE: (id: string) => `${API_V1}/visions/${id}/add-experience`,
    HARVEST: (id: string) => `${API_V1}/visions/${id}/harvest`,
    STATS: (id: string) => `${API_V1}/visions/${id}/stats`,
    EXPERIENCE_RATES: `${API_V1}/visions/experience-rates`,
  },
  TASKS: {
    BASE: `${API_V1}/tasks/`,
    BY_ID: (id: string) => `${API_V1}/tasks/${id}`,
    STATUS: (id: string) => `${API_V1}/tasks/${id}/status`,
    BY_VISION_HIERARCHY: (visionId: string) =>
      `${API_V1}/tasks/vision/${visionId}/hierarchy`,
    WITH_SUBTASKS: (id: string) => `${API_V1}/tasks/${id}/with-subtasks`,
    REORDER: `${API_V1}/tasks/reorder`,
    MOVE: (id: string) => `${API_V1}/tasks/${id}/move`,
    STATS: (id: string) => `${API_V1}/tasks/${id}/stats`,
  },
  TIMELOGS: {
    BASE: `${API_V1}/timelogs/`,
    BY_ID: (id: string) => `${API_V1}/timelogs/${id}`,
    BATCH_UPDATE: `${API_V1}/timelogs/batch-update`,
    TEMPLATES: {
      BASE: `${API_V1}/timelogs/templates/`,
      BULK: `${API_V1}/timelogs/templates/bulk`,
      BY_ID: (id: string) => `${API_V1}/timelogs/templates/${id}`,
      REORDER: `${API_V1}/timelogs/templates/reorder`,
      BUMP_USAGE: (id: string) =>
        `${API_V1}/timelogs/templates/${id}/bump-usage`,
    },
  },
  NOTES: {
    BASE: `${API_V1}/notes/`,
    BY_ID: (id: string) => `${API_V1}/notes/${id}`,
    STATS_PERSONS: `${API_V1}/notes/stats/persons`,
    TAG_BY_ID: (noteId: string, tagId: string) =>
      `${API_V1}/notes/${noteId}/tags/${tagId}`,
    ADVANCED_SEARCH: `${API_V1}/notes/advanced-search`,
    BATCH_UPDATE: `${API_V1}/notes/batch-update`,
    BATCH_DELETE: `${API_V1}/notes/batch-delete`,
    BATCH_CREATE: `${API_V1}/notes/batch-create`,
    INGEST_JOB: (jobId: string) => `${API_V1}/notes/ingest-jobs/${jobId}`,
  },
  HABITS: {
    BASE: `${API_V1}/habits/`,
    BY_ID: (id: string) => `${API_V1}/habits/${id}`,
    OVERVIEWS: `${API_V1}/habits/overviews`,
    ACTIONS_BY_DATE: (date: string) =>
      `${API_V1}/habits/actions/by-date/${date}`,
    OVERVIEW_BY_ID: (id: string) => `${API_V1}/habits/${id}/overview`,
    ACTIONS: (habitId: string) => `${API_V1}/habits/${habitId}/actions`,
    ACTION_BY_ID: (habitId: string, actionId: string) =>
      `${API_V1}/habits/${habitId}/actions/${actionId}`,
    TASK_ASSOCIATIONS: `${API_V1}/habits/habit-task-associations/`,
  },
  PERSONS: {
    BASE: `${API_V1}/persons/`,
    BY_ID: (id: string) => `${API_V1}/persons/${id}`,
    ACTIVITIES: (id: string) => `${API_V1}/persons/${id}/activities/`,
    ANNIVERSARIES: (id: string) => `${API_V1}/persons/${id}/anniversaries/`,
    ANNIVERSARY_BY_ID: (personId: string, anniversaryId: string) =>
      `${API_V1}/persons/${personId}/anniversaries/${anniversaryId}`,
    TAG_BY_ID: (personId: string, tagId: string) =>
      `${API_V1}/persons/${personId}/tags/${tagId}`,
    SEARCH_BY_TAG: `${API_V1}/persons/search-by-tag`,
  },
  AREAS: {
    BASE: `${API_V1}/areas/`,
    BY_ID: (id: string) => `${API_V1}/areas/${id}`,
    ACTIVATE: (id: string) => `${API_V1}/areas/${id}/activate`,
    ORDER: `${API_V1}/areas/order`,
  },
  PLANNED_EVENTS: {
    BASE: `${API_V1}/planned-events/`,
    RAW: `${API_V1}/planned-events/raw`,
    BY_TASK: (taskId: string) => `${API_V1}/planned-events/by-task/${taskId}`,
    BY_ID: (id: string) => `${API_V1}/planned-events/${id}`,
  },
  PREFERENCES: {
    BY_KEY: (key: string) => `${API_V1}/preferences/${encodeURIComponent(key)}`,
  },
  FINANCE: {
    ASSETS: `${API_V1}/finance/assets`,
    ASSET_BY_ID: (id: string) => `${API_V1}/finance/assets/${id}`,
    TREES: `${API_V1}/finance/trees`,
    RATE_SNAPSHOTS: `${API_V1}/finance/rate-snapshots`,
    RATE_SNAPSHOT_BY_ID: (id: string) => `${API_V1}/finance/rate-snapshots/${id}`,
    ENSURE_DEFAULT_TREE: `${API_V1}/finance/trees/ensure-default`,
    TREE_BY_ID: (id: string) => `${API_V1}/finance/trees/${id}`,
    TREE_NODES: (treeId: string) => `${API_V1}/finance/trees/${treeId}/nodes`,
    NODE_BY_ID: (id: string) => `${API_V1}/finance/nodes/${id}`,
    SNAPSHOTS: `${API_V1}/finance/snapshots`,
    TREE_SNAPSHOTS: (treeId: string) =>
      `${API_V1}/finance/trees/${treeId}/snapshots`,
    SNAPSHOT_BY_ID: (id: string) => `${API_V1}/finance/snapshots/${id}`,
  },
  STATS: {
    DAILY_AREAS: `${API_V1}/stats/daily-areas`,
    DAY_BREAKDOWN: `${API_V1}/stats/day-breakdown`,
    AGGREGATED_AREAS: `${API_V1}/stats/aggregated-areas`,
    DAILY_AREAS_RECOMPUTE: `${API_V1}/stats/daily-areas/recompute`,
    NOTES_TOTAL: `${API_V1}/stats/notes/total`,
    TAGS_USAGE: (entityType: string) =>
      `${API_V1}/stats/tags/usage/${entityType}`,
    TAGS_USAGE_NOTE: `${API_V1}/stats/tags/usage/note`,
  },
} as const;
