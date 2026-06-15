import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { PersonSummary } from "./types/common";
import type { UUID } from "@/types/primitive";
import { DataCleaner } from "@/utils/protocol";
import type { ListResponse } from "@/types/pagination";
import type { NoteSummary } from "./notes";

// Types local to actual events
interface DimensionSummary {
  id: UUID;
  name: string;
  color?: string | null;
}

interface VisionSummary {
  id: UUID;
  name: string;
  status?: string | null;
  dimension_id?: UUID | null;
}

export interface ActualEventTaskSummary {
  id: UUID;
  content: string;
  vision_id: UUID | null;
  status?: string;
  vision_summary?: VisionSummary | null;
}

export interface ActualEvent {
  id: UUID;
  title: string;
  start_time: string;
  end_time: string;
  dimension_id: UUID | null;
  task_id?: UUID | null;
  dimension_summary?: DimensionSummary | null;
  tracking_method: string;
  location?: string | null;
  energy_level?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  extra_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  persons?: PersonSummary[];
  // Preferred single associated task summary
  task?: ActualEventTaskSummary | null;
  linked_notes?: NoteSummary[];
  linked_notes_count?: number;
}

export interface ActualEventCreate {
  title: string;
  start_time: string;
  end_time: string;
  dimension_id: UUID | null;
  tracking_method?: string;
  location?: string;
  energy_level?: number;
  notes?: string;
  tags?: string[];
  extra_data?: Record<string, unknown>;
  task_id?: UUID | null; // single associated task
  person_ids?: UUID[];
  [key: string]: unknown;
}

export type ActualEventUpdate = Partial<ActualEventCreate>;

interface EnergyInjectionResult {
  vision_id: UUID;
  experience_gained: number;
  stage_evolved: boolean;
  new_stage: number;
  total_experience: number;
}

export interface ActualEventWithEnergyResponse extends ActualEvent {
  energy_injections?: EnergyInjectionResult[];
}

export interface ActualEventAdvancedSearchRequest {
  start_date: string;
  end_date?: string;
  dimension_id?: UUID | null;
  without_dimension?: boolean;
  dimension_name?: string | null;
  description_keyword?: string | null;
  task_id?: UUID | null;
}

export interface ActualEventAdvancedSearchMetadata {
  start_date?: string | null;
  end_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  tracking_method?: string | null;
  dimension_id?: UUID | null;
  without_dimension?: boolean | null;
  dimension_name?: string | null;
  description_keyword?: string | null;
  task_id?: UUID | null;
  limit?: number | null;
  returned_count?: number | null;
  total_count?: number | null;
  truncated?: boolean | null;
}

export type ActualEventListResponse = ListResponse<
  ActualEvent,
  ActualEventAdvancedSearchMetadata
>;

export type ActualEventAdvancedSearchResponse = ActualEventListResponse;

const TIMELOG_PAGE_SIZE = 500;
const MAX_TIMELOG_RANGE_PAGES = 100;

function toTimelogPayload(
  payload: ActualEventCreate | ActualEventUpdate,
): Record<string, unknown> {
  return {
    title: payload.title,
    start_time: payload.start_time,
    end_time: payload.end_time,
    tracking_method: payload.tracking_method ?? "manual",
    location: payload.location,
    energy_level: payload.energy_level,
    notes: payload.notes,
    area_id: payload.dimension_id,
    task_id: payload.task_id,
    person_ids: payload.person_ids,
  };
}

export const actualEventsApi = {
  fetchRange: async (start: string, end: string, trackingMethod?: string) => {
    const items: ActualEvent[] = [];
    let firstResponse: ActualEventListResponse | null = null;
    let page = 1;
    let totalCount = 0;
    let totalPages = 0;

    while (page <= MAX_TIMELOG_RANGE_PAGES) {
      const response = await http.get<ActualEventListResponse>(
        ENDPOINTS.TIMELOGS.BASE,
        {
          window_start: start,
          window_end: end,
          tracking_method: trackingMethod,
          page,
          size: TIMELOG_PAGE_SIZE,
        },
      );

      firstResponse ??= response;
      items.push(...response.items);
      totalPages = response.pagination?.pages ?? 0;
      totalCount = response.pagination?.total ?? items.length;
      const backendTruncated = response.meta?.truncated === true;

      if (items.length >= totalCount) break;
      if (totalPages > 0 && page >= totalPages) break;
      if (!backendTruncated && response.items.length < TIMELOG_PAGE_SIZE) break;

      page += 1;
    }

    if (!firstResponse) {
      return {
        items: [],
        pagination: { page: 1, size: 0, total: 0, pages: 0 },
        meta: {
          returned_count: 0,
          total_count: 0,
          truncated: false,
        },
      };
    }

    const truncated = items.length < totalCount;
    return {
      items,
      pagination: {
        page: 1,
        size: items.length,
        total: totalCount,
        pages: truncated ? Math.max(totalPages, 1) : 1,
      },
      meta: {
        ...firstResponse.meta,
        returned_count: items.length,
        total_count: totalCount,
        truncated,
      },
    };
  },

  create: (payload: ActualEventCreate) => {
    const cleanedData = DataCleaner.create(toTimelogPayload(payload));
    return http.post<ActualEventWithEnergyResponse>(
      ENDPOINTS.TIMELOGS.BASE,
      cleanedData,
    );
  },

  batchCreate: (events: ActualEventCreate[]) => {
    const cleanedEvents = events.map((event) =>
      DataCleaner.create(toTimelogPayload(event)),
    );

    return Promise.all(
      cleanedEvents.map((event) =>
        http.post<ActualEvent>(ENDPOINTS.TIMELOGS.BASE, event),
      ),
    ).then((createdEvents) => ({
      created_count: createdEvents.length,
      failed_count: 0,
      created_events: createdEvents,
      errors: [],
    }));
  },

  update: (id: UUID, payload: ActualEventUpdate) => {
    // 使用新的数据协议，支持明确设置空值
    const cleanedData = DataCleaner.update(toTimelogPayload(payload));

    return http.patch<ActualEvent>(
      ENDPOINTS.TIMELOGS.BY_ID(id),
      cleanedData,
    );
  },

  quickEnd: (id: UUID) =>
    http.patch<ActualEvent>(ENDPOINTS.TIMELOGS.BY_ID(id), {
      end_time: new Date().toISOString(),
    }),

  delete: (id: UUID) => http.delete<void>(ENDPOINTS.TIMELOGS.BY_ID(id)),

  batchDelete: (eventIds: UUID[]) =>
    Promise.allSettled(
      eventIds.map((eventId) => http.delete<void>(ENDPOINTS.TIMELOGS.BY_ID(eventId))),
    ).then((results) => {
      const failedIds = eventIds.filter((_, index) => results[index].status === "rejected");
      return {
        deleted_count: eventIds.length - failedIds.length,
        failed_ids: failedIds,
        errors: [],
      };
    }),

  restore: (_id: UUID) =>
    Promise.reject(new Error("Restore is not supported by LifeOS timelogs yet.")),

  batchRestore: (eventIds: UUID[]) =>
    Promise.resolve({
      deleted_count: 0,
      failed_ids: eventIds,
      errors: ["Restore is not supported by LifeOS timelogs yet."],
    }),

  advancedSearch: async (params: ActualEventAdvancedSearchRequest) => {
    const withoutDimension =
      params.without_dimension ?? params.dimension_id === null;
    const response = await http.get<ActualEventAdvancedSearchResponse>(
      ENDPOINTS.TIMELOGS.BASE,
      {
        window_start: params.start_date,
        window_end: params.end_date,
        query: params.description_keyword ?? undefined,
        dimension_id: withoutDimension
          ? undefined
          : (params.dimension_id ?? undefined),
        without_dimension: withoutDimension || undefined,
        dimension_name: params.dimension_name ?? undefined,
        task_id: params.task_id ?? undefined,
        size: 500,
      },
    );
    const returnedCount = response.items.length;
    const totalCount = response.pagination?.total ?? returnedCount;
    return {
      ...response,
      meta: {
        ...response.meta,
        start_date: response.meta?.start_date ?? params.start_date,
        end_date:
          response.meta?.end_date ??
          (params.end_date ? params.end_date : null),
        window_start: response.meta?.window_start ?? params.start_date,
        window_end:
          response.meta?.window_end ?? (params.end_date ? params.end_date : null),
        dimension_id:
          response.meta?.dimension_id ?? params.dimension_id ?? null,
        without_dimension:
          response.meta?.without_dimension ?? withoutDimension,
        dimension_name:
          response.meta?.dimension_name ?? params.dimension_name ?? null,
        description_keyword:
          response.meta?.description_keyword ??
          params.description_keyword ??
          null,
        task_id: response.meta?.task_id ?? params.task_id ?? null,
        limit: response.meta?.limit ?? 500,
        returned_count: response.meta?.returned_count ?? returnedCount,
        total_count: response.meta?.total_count ?? totalCount,
        truncated: response.meta?.truncated ?? returnedCount < totalCount,
      },
    };
  },

  batchUpdate: (params: {
    event_ids: UUID[];
    update_type: "persons" | "title" | "task" | "dimension";
    persons?: {
      mode: "add" | "replace" | "clear";
      person_ids: UUID[];
    };
    title?: {
      mode: "replace" | "find_replace";
      value: string;
      find?: string;
    };
    task?: {
      mode: "replace" | "clear";
      task_id?: UUID;
    };
    dimension?: {
      dimension_id: UUID | null;
    };
  }) =>
    http.post<{
      updated_count: number;
      unchanged_ids?: UUID[];
      failed_ids: UUID[];
      errors: string[];
    }>(ENDPOINTS.TIMELOGS.BATCH_UPDATE, params),
};
