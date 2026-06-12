// Vision and Task Management Constants
import { t } from "@/i18n";
import type { IconName } from "@/components/icons";

export const VISION_EXPERIENCE_RATE_MAX = 3600;
export const QUICK_TIME_ENTRY_MAX_DURATION_MINUTES = 1440;
export const MAX_TASKS_PAGE_SIZE = 500;
const TASK_STATUS_CONFIG = {
  todo: {
    iconName: "timer" as IconName,
    color: "text-base-content/80",
    bgColor: "bg-base-200/50",
    hoverColor: "hover:bg-base-300/60",
  },
  in_progress: {
    iconName: "refresh" as IconName,
    color: "text-warning",
    bgColor: "bg-warning/15",
    hoverColor: "hover:bg-warning/25",
  },
  done: {
    iconName: "check" as IconName,
    color: "text-success",
    bgColor: "bg-success/15",
    hoverColor: "hover:bg-success/25",
  },
  cancelled: {
    iconName: "x-mark" as IconName,
    color: "text-base-content/60",
    bgColor: "bg-base-300/50",
    hoverColor: "hover:bg-base-400/60",
  },
  paused: {
    iconName: "pause" as IconName,
    color: "text-info",
    bgColor: "bg-info/15",
    hoverColor: "hover:bg-info/25",
  },
} as const;

export const TASK_STATUS_LABELS = {
  todo: t("status.todo"),
  in_progress: t("status.in_progress"),
  done: t("status.done"),
  cancelled: t("status.cancelled"),
  paused: t("status.paused"),
} as const;

// Task status arrays for filtering
export const ALL_TASK_STATUSES = [
  "todo",
  "in_progress",
  "paused",
  "done",
  "cancelled",
] as const;
export const ACTIVE_TASK_STATUSES = ["todo", "in_progress", "paused"] as const;

export const PRIORITY = [
  {
    value: "0",
    iconName: null as IconName | null,
    text: t("priority.0"),
    label: t("priority.0"),
  },
  {
    value: "1",
    iconName: "document-text" as IconName,
    text: t("priority.1"),
    label: t("priority.1"),
  },
  {
    value: "2",
    iconName: "pin" as IconName,
    text: t("priority.2"),
    label: t("priority.2"),
  },
  {
    value: "3",
    iconName: "star" as IconName,
    text: t("priority.3"),
    label: t("priority.3"),
  },
  {
    value: "4",
    iconName: "bolt" as IconName,
    text: t("priority.4"),
    label: t("priority.4"),
  },
  {
    value: "5",
    iconName: "fire" as IconName,
    text: t("priority.5"),
    label: t("priority.5"),
  },
];

/**
 * Get task status styling configuration for task cards
 * @param status - Task status string
 * @returns Complete styling configuration object
 */
export const getTaskStatusStyling = (status: string) => {
  const config =
    TASK_STATUS_CONFIG[status as keyof typeof TASK_STATUS_CONFIG] ||
    TASK_STATUS_CONFIG.todo;
  return {
    bgColor: config.bgColor,
    hoverColor: config.hoverColor,
    textColor: config.color,
    iconName: config.iconName,
  };
};

// Habit status filter options for dropdowns
export const HABIT_STATUS_FILTER_OPTIONS = [
  { value: "active", label: t("status.active") },
  { value: "completed", label: t("status.completed") },
  { value: "paused", label: t("status.paused") },
  { value: "expired", label: t("status.expired") },
];

// Vision status filter options for dropdowns
export const VISION_STATUS_FILTER_OPTIONS = [
  { value: "active", label: t("status.active") },
  { value: "archived", label: t("status.archived") },
  { value: "fruit", label: t("status.fruit") },
];

// All available vision statuses for filtering
export const ALL_VISION_STATUSES = ["active", "archived", "fruit"];

// Habit duration options for form dropdowns
export const HABIT_DURATION_OPTIONS = [
  { value: "7", label: t("habitForm.durationOptions.7") },
  { value: "14", label: t("habitForm.durationOptions.14") },
  { value: "21", label: t("habitForm.durationOptions.21") },
  { value: "100", label: t("habitForm.durationOptions.100") },
  { value: "365", label: t("habitForm.durationOptions.365") },
  { value: "1000", label: t("habitForm.durationOptions.1000") },
];

export const HABIT_EDITABLE_DAYS = 10000;
export const MAX_HABIT_ACTION_WINDOW_DAYS = 100;

// Habit action status configuration - Single source of truth for frontend
export const HABIT_ACTION_STATUS_CONFIG = {
  pending: {
    value: "pending",
    label: t("status.pending"),
    color: "blue",
    bgColor: "bg-info/20",
    borderColor: "border-info/50",
    cellStatus: "todo",
    isDefault: true,
    isManual: false,
    countAsCompleted: false,
  },
  done: {
    value: "done",
    label: t("status.done"),
    color: "green",
    bgColor: "bg-success/20",
    borderColor: "border-success/50",
    cellStatus: "completed",
    isDefault: false,
    isManual: true,
    countAsCompleted: true,
  },
  skip: {
    value: "skip",
    label: t("status.skip"),
    color: "gray",
    bgColor: "bg-base-200",
    borderColor: "border-base-300",
    cellStatus: "skipped",
    isDefault: false,
    isManual: true,
    countAsCompleted: false,
  },
  miss: {
    value: "miss",
    label: t("status.miss"),
    color: "red",
    bgColor: "bg-error/20",
    borderColor: "border-error/50",
    cellStatus: "missed",
    isDefault: false,
    isManual: true,
    countAsCompleted: false,
  },
} as const;

// Habit action status options for dropdowns (derived from config)
export const HABIT_ACTION_STATUS_OPTIONS = Object.values(
  HABIT_ACTION_STATUS_CONFIG,
).map((config) => ({
  value: config.value,
  label: config.label,
}));
