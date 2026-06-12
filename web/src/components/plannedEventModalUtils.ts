import type {
  PlannedEvent,
  PlannedEventCreate,
  PlannedEventUpdate,
} from "@/services/api/plannedEvents";

interface PlannedEventInitialDateInfo {
  start: Date;
  end: Date;
  allDay: boolean;
}

const PLANNED_EVENT_UPDATE_FIELDS = [
  "title",
  "start_time",
  "end_time",
  "priority",
  "dimension_id",
  "task_id",
  "is_all_day",
  "is_recurring",
  "recurrence_pattern",
  "rrule_string",
  "status",
  "tags",
  "extra_data",
  "person_ids",
] as const satisfies readonly (keyof PlannedEventCreate)[];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const areFieldValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return left === right;
};

export const createEmptyPlannedEventFormData = (): PlannedEventCreate => ({
  title: "",
  start_time: "",
  end_time: "",
  priority: 0,
  dimension_id: null,
  task_id: null,
  is_all_day: false,
  is_recurring: false,
  rrule_string: "",
  status: "planned",
  tags: [],
  person_ids: [],
});

export const buildPlannedEventFormData = ({
  event,
  initialDateInfo,
}: {
  event?: PlannedEvent | null;
  initialDateInfo?: PlannedEventInitialDateInfo | null;
}): PlannedEventCreate => {
  if (event) {
    return {
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time || "",
      priority: event.priority,
      dimension_id: event.dimension_id,
      task_id: event.task_id || null,
      is_all_day: event.is_all_day,
      is_recurring: event.is_recurring,
      recurrence_pattern: event.recurrence_pattern ?? undefined,
      rrule_string: event.rrule_string || "",
      status: event.status,
      tags: event.tags ? [...event.tags] : [],
      extra_data: event.extra_data ?? undefined,
      person_ids: event.persons?.map((person) => person.id) || [],
    };
  }

  if (initialDateInfo) {
    return {
      ...createEmptyPlannedEventFormData(),
      start_time: initialDateInfo.start.toISOString(),
      end_time: initialDateInfo.allDay ? "" : initialDateInfo.end.toISOString(),
      is_all_day: initialDateInfo.allDay,
    };
  }

  return createEmptyPlannedEventFormData();
};

export const buildPlannedEventUpdatePayload = (
  initialData: PlannedEventCreate,
  currentData: PlannedEventCreate,
): PlannedEventUpdate =>
  Object.fromEntries(
    PLANNED_EVENT_UPDATE_FIELDS.flatMap((field) => {
      const initialValue = initialData[field];
      const currentValue = currentData[field];
      return areFieldValuesEqual(initialValue, currentValue)
        ? []
        : [[field, currentValue]];
    }),
  ) as PlannedEventUpdate;
