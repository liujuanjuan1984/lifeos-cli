import type { PersonSummary } from "./types/common";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface PlannedEvent {
  id: UUID;
  title: string;
  start_time: string;
  end_time?: string | null;
  priority: number;
  area_id: UUID | null;
  task_id?: UUID | null;
  is_all_day: boolean;
  is_recurring: boolean;
  recurrence_pattern?: Record<string, unknown> | null;
  rrule_string?: string | null;
  status: string;
  tags?: string[] | null;
  extra_data?: Record<string, unknown> | null;
  is_instance?: boolean;
  master_event_id?: UUID;
  instance_id?: UUID;
  people?: PersonSummary[];
}

interface PlannedEventListMeta {
  start?: string | null;
  end?: string | null;
  status?: string | null;
  task_id?: UUID | null;
}

export type PlannedEventListResponse = ListResponse<
  PlannedEvent,
  PlannedEventListMeta
>;

export interface PlannedEventCreate {
  title: string;
  start_time: string;
  end_time?: string;
  priority?: number;
  area_id: UUID | null;
  task_id?: UUID | null;
  is_all_day?: boolean;
  is_recurring?: boolean;
  recurrence_pattern?: Record<string, unknown>;
  rrule_string?: string;
  status?: string;
  tags?: string[];
  extra_data?: Record<string, unknown>;
  person_ids?: UUID[];
}

export type PlannedEventUpdate = Partial<PlannedEventCreate>;

export type PlannedEventDeleteOptions = {
  deleteType?: "single" | "all_future" | "all";
  instanceId?: UUID;
  instanceStart?: string;
};

export type PlannedEventUpdateOptions = {
  updateType?: "single" | "all_future" | "all";
  instanceId?: UUID;
  instanceStart?: string;
};

export const plannedEventsApi = {
  fetchRange: async (start: string, end: string, status?: string) =>
    http.get<PlannedEventListResponse>(ENDPOINTS.PLANNED_EVENTS.BASE, {
      start,
      end,
      status,
      page: 1,
      size: 500,
    }),
  fetchRaw: async (page = 1, size = 100, status?: string) =>
    http.get<PlannedEventListResponse>(ENDPOINTS.PLANNED_EVENTS.RAW, {
      page,
      size,
      status,
    }),
  fetchByTask: async (taskId: UUID, page = 1, size = 100) =>
    http.get<PlannedEventListResponse>(
      ENDPOINTS.PLANNED_EVENTS.BY_TASK(taskId),
      { page, size },
    ),
  create: (payload: PlannedEventCreate): Promise<PlannedEvent> =>
    http.post<PlannedEvent>(ENDPOINTS.PLANNED_EVENTS.BASE, payload),
  getById: (id: UUID): Promise<PlannedEvent> =>
    http.get<PlannedEvent>(ENDPOINTS.PLANNED_EVENTS.BY_ID(id)),
  update: (
    id: UUID,
    payload: PlannedEventUpdate,
    options?: PlannedEventUpdateOptions,
  ): Promise<PlannedEvent> =>
    http.patch<PlannedEvent>(ENDPOINTS.PLANNED_EVENTS.BY_ID(id), payload, {
      updateType: options?.updateType,
      instanceStart: options?.instanceStart,
    }),
  delete: (id: UUID, options?: PlannedEventDeleteOptions): Promise<void> =>
    http.delete<void>(ENDPOINTS.PLANNED_EVENTS.BY_ID(id), {
      deleteType: options?.deleteType,
      instanceStart: options?.instanceStart,
    }),
};
