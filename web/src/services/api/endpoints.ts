const API_V1 = "/api/v1";

export const ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_V1}/auth/login`,
    REGISTER: `${API_V1}/auth/register`,
    REFRESH: `${API_V1}/auth/refresh`,
    LOGOUT: `${API_V1}/auth/logout`,
    ME: `${API_V1}/auth/me`,
    CHANGE_PASSWORD: `${API_V1}/auth/password/change`,
  },
  INVITATIONS: {
    BASE: `${API_V1}/invitations/`,
    MINE: `${API_V1}/invitations/mine`,
    INVITED_ME: `${API_V1}/invitations/invited-me`,
    BY_ID: (id: string) => `${API_V1}/invitations/${id}`,
    RESTORE: (id: string) => `${API_V1}/invitations/${id}/restore`,
    LOOKUP_PREFIX: `${API_V1}/invitations/lookup/`,
    LOOKUP: (code: string) => `${API_V1}/invitations/lookup/${code}`,
  },
  TAGS: {
    BASE: `${API_V1}/tags/`,
    BY_ID: (id: string) => `${API_V1}/tags/${id}`,
    BATCH_UPDATE: `${API_V1}/tags/batch-update`,
    ENTITY_TYPES: `${API_V1}/tags/entity-types/`,
    CATEGORIES: `${API_V1}/tags/categories/`,
    USAGE: (id: string) => `${API_V1}/tags/${id}/usage`,
  },
  FINANCE: {
    BASE: `${API_V1}/finance`,
    ACCOUNTS: {
      TREE: `${API_V1}/finance/accounts/tree`,
      TREES: `${API_V1}/finance/accounts/trees`,
      TREE_BY_ID: (id: string) => `${API_V1}/finance/accounts/trees/${id}`,
      BASE: `${API_V1}/finance/accounts/`,
      BY_ID: (id: string) => `${API_V1}/finance/accounts/${id}`,
    },
    CASHFLOW: {
      SOURCES: `${API_V1}/finance/cashflow/sources`,
      TREES: `${API_V1}/finance/cashflow/trees`,
      TREE_BY_ID: (id: string) => `${API_V1}/finance/cashflow/trees/${id}`,
      SNAPSHOTS: `${API_V1}/finance/cashflow/snapshots`,
      SNAPSHOT_BY_ID: (id: string) =>
        `${API_V1}/finance/cashflow/snapshots/${id}`,
      SNAPSHOT_COMPARE: (baseId: string, compareId: string) =>
        `${API_V1}/finance/cashflow/snapshots/${baseId}/compare/${compareId}`,
      BILLING_APPLY: `${API_V1}/finance/cashflow/billing/apply`,
      BILLING_HISTORY: (sourceId: string) =>
        `${API_V1}/finance/cashflow/billing/${sourceId}`,
      BILLING_HISTORY_BULK: (sourceId: string) =>
        `${API_V1}/finance/cashflow/billing/${sourceId}/history`,
      BILLING_MONTHS: (sourceId: string) =>
        `${API_V1}/finance/cashflow/billing/${sourceId}/months`,
    },
    EXCHANGE_RATES: {
      BASE: `${API_V1}/finance/exchange-rates`,
      PLANS: (planId: string) =>
        `${API_V1}/finance/exchange-rates/plans/${planId}`,
      LATEST: `${API_V1}/finance/exchange-rates/latest`,
      QUERY: `${API_V1}/finance/exchange-rates`,
    },
    BALANCE_SNAPSHOTS: {
      BASE: `${API_V1}/finance/balance-snapshots`,
      BY_ID: (id: string) => `${API_V1}/finance/balance-snapshots/${id}`,
      COMPARE: (baseId: string, compareId: string) =>
        `${API_V1}/finance/balance-snapshots/${baseId}/compare/${compareId}`,
    },
    TRADING: {
      PLANS: `${API_V1}/finance/trading-plans`,
      PLAN_BY_ID: (id: string) => `${API_V1}/finance/trading-plans/${id}`,
      PLAN_ARCHIVE: (id: string) =>
        `${API_V1}/finance/trading-plans/${id}/archive`,
      PLAN_INSTRUMENTS: (planId: string) =>
        `${API_V1}/finance/trading-plans/${planId}/instruments`,
      PLAN_INSTRUMENT_BY_ID: (planId: string, instrumentId: string) =>
        `${API_V1}/finance/trading-plans/${planId}/instruments/${instrumentId}`,
      PLAN_SUMMARY: (planId: string) =>
        `${API_V1}/finance/trading-plans/${planId}/summary`,
      PLAN_RATE_SNAPSHOT: (planId: string) =>
        `${API_V1}/finance/trading-plans/${planId}/rate-snapshot`,
      ENTRIES: `${API_V1}/finance/trading-entries`,
      ENTRY_BY_ID: (id: string) => `${API_V1}/finance/trading-entries/${id}`,
    },
  },
  VISIONS: {
    BASE: `${API_V1}/visions/`,
    BY_ID: (id: string) => `${API_V1}/visions/${id}`,
    WITH_TASKS: (id: string) => `${API_V1}/visions/${id}/with-tasks`,
    ADD_EXPERIENCE: (id: string) => `${API_V1}/visions/${id}/add-experience`,
    HARVEST: (id: string) => `${API_V1}/visions/${id}/harvest`,
    STATS: (id: string) => `${API_V1}/visions/${id}/stats`,
    EXPERIENCE_RATES: `${API_V1}/visions/experience-rates`,
    EXPORT: (id: string) => `${API_V1}/visions/${id}/export`,
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
    ACTUAL_EVENTS: (id: string) => `${API_V1}/tasks/${id}/actual-events`,
  },
  TIMELOGS: {
    BASE: `${API_V1}/timelogs/`,
    BY_ID: (id: string) => `${API_V1}/timelogs/${id}`,
    BATCH_UPDATE: `${API_V1}/timelogs/batch-update`,
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
  DIMENSIONS: {
    BASE: `${API_V1}/dimensions/`,
    BY_ID: (id: string) => `${API_V1}/dimensions/${id}`,
    ACTIVATE: (id: string) => `${API_V1}/dimensions/${id}/activate`,
    ORDER: `${API_V1}/dimensions/order`,
  },
  PLANNED_EVENTS: {
    BASE: `${API_V1}/planned-events/`,
    RAW: `${API_V1}/planned-events/raw`,
    BY_TASK: (taskId: string) => `${API_V1}/planned-events/by-task/${taskId}`,
    BY_ID: (id: string) => `${API_V1}/planned-events/${id}`,
  },
  FOODS: {
    BASE: `${API_V1}/foods/`,
    BY_ID: (id: string) => `${API_V1}/foods/${id}`,
  },
  FOOD_ENTRIES: {
    BASE: `${API_V1}/food-entries/`,
    BY_ID: (id: string) => `${API_V1}/food-entries/${id}`,
    DAILY_SUMMARY: (date: string) =>
      `${API_V1}/food-entries/daily-summary/${date}`,
  },
  NOTIFICATIONS: {
    SYSTEM: `${API_V1}/notifications/system`,
    SYSTEM_UNREAD_COUNT: `${API_V1}/notifications/system/unread-count`,
    SYSTEM_MARK_READ: `${API_V1}/notifications/system/mark-read`,
  },
  AGENTS: {
    REGISTRY: `${API_V1}/agent/registry`,
    CHAT: `${API_V1}/agent/chat`,
    HISTORY: `${API_V1}/agent/history`,
    HISTORY_BY_ID: (sessionId: string) =>
      `${API_V1}/agent/history/${sessionId}`,
    SESSIONS: `${API_V1}/agent/sessions`,
    SESSION_BY_ID: (sessionId: string) =>
      `${API_V1}/agent/sessions/${sessionId}`,
    CONTEXT_SESSION: `${API_V1}/agent/context/session`,
    CONTEXT_SESSION_STATE: `${API_V1}/agent/context/session/state`,
  },
  ACTUAL_EVENTS: {
    BASE: `${API_V1}/actual-events/`,
    BY_ID: (id: string) => `${API_V1}/actual-events/${id}`,
    BATCH_CREATE: `${API_V1}/actual-events/batch-create`,
    QUICK_END: (id: string) => `${API_V1}/actual-events/${id}/quick-end`,
    BATCH_DELETE: `${API_V1}/actual-events/batch-delete`,
    RESTORE: (id: string) => `${API_V1}/actual-events/${id}/restore`,
    BATCH_RESTORE: `${API_V1}/actual-events/batch-restore`,
    ADVANCED_SEARCH: `${API_V1}/actual-events/advanced-search`,
    BATCH_UPDATE: `${API_V1}/actual-events/batch-update`,
    TEMPLATES: {
      BASE: `${API_V1}/actual-events/templates/`,
      BY_ID: (id: string) => `${API_V1}/actual-events/templates/${id}`,
      BULK: `${API_V1}/actual-events/templates/bulk`,
      REORDER: `${API_V1}/actual-events/templates/reorder`,
      BUMP_USAGE: (id: string) =>
        `${API_V1}/actual-events/templates/${id}/bump-usage`,
    },
  },
  EXPORT: {
    TIMELOG: `${API_V1}/export/timelog`,
    NOTES: `${API_V1}/export/notes`,
    PLANNING: `${API_V1}/export/planning`,
    VISION_BY_ID: (visionId: string) => `${API_V1}/export/visions/${visionId}`,
    FINANCE_TRADING: `${API_V1}/export/finance/trading`,
    FINANCE_ACCOUNTS: `${API_V1}/export/finance/accounts`,
    FINANCE_CASHFLOW: `${API_V1}/export/finance/cashflow`,
    FULL: `${API_V1}/export/full`,
    ESTIMATE: `${API_V1}/export/estimate`,
    TIMELOG_TEXT: `${API_V1}/export/timelog/export`,
    NOTES_TEXT: `${API_V1}/export/notes/export`,
    PLANNING_TEXT: `${API_V1}/export/planning/export`,
  },
  PREFERENCES: {
    BY_KEY: (key: string) => `${API_V1}/preferences/${encodeURIComponent(key)}`,
  },
  SAGE_MAXIMS: {
    BASE: `${API_V1}/sage-maxims/`,
    REACTION: (maximId: string) => `${API_V1}/sage-maxims/${maximId}/reaction`,
  },
  LLM_CREDENTIALS: {
    BASE: `${API_V1}/me/llm-credentials`,
    BY_ID: (id: string) => `${API_V1}/me/llm-credentials/${id}`,
    TEST: `${API_V1}/me/llm-credentials/test`,
    DEFAULT: (id: string) => `${API_V1}/me/llm-credentials/${id}/default`,
  },
  CARDBOX: {
    CONTEXT_LIST: `${API_V1}/cardbox/context/list`,
    CONTEXT_CREATE: `${API_V1}/cardbox/context/create`,
    CONTEXT_BY_ID: (boxId: string) => `${API_V1}/cardbox/context/${boxId}`,
    CONTEXT_ITEMS_BY_ID: (boxId: string) =>
      `${API_V1}/cardbox/context/${boxId}/items`,
  },
  ADMIN: {
    MAINTENANCE: {
      RECOMPUTE_VISION: (id: string) =>
        `${API_V1}/admin/maintenance/recompute/vision/${id}`,
    },
  },
  STATS: {
    DAILY_DIMENSIONS: `${API_V1}/stats/daily-dimensions`,
    DAY_BREAKDOWN: `${API_V1}/stats/day-breakdown`,
    AGGREGATED_DIMENSIONS: `${API_V1}/stats/aggregated-dimensions`,
    DAILY_DIMENSIONS_RECOMPUTE: `${API_V1}/stats/daily-dimensions/recompute`,
    NOTES_TOTAL: `${API_V1}/stats/notes/total`,
    TAGS_USAGE: (entityType: string) =>
      `${API_V1}/stats/tags/usage/${entityType}`,
    TAGS_USAGE_NOTE: `${API_V1}/stats/tags/usage/note`,
  },
} as const;
