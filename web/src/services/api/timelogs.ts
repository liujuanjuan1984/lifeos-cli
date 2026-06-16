import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { PersonSummary } from "./types/common";
import type { UUID } from "@/types/primitive";
import { DataCleaner } from "@/utils/protocol";
import type { ListResponse } from "@/types/pagination";
import type { NoteSummary } from "./notes";

// Types local to timelogs
interface AreaSummary {
  id: UUID;
  name: string;
  color?: string | null;
}

interface VisionSummary {
  id: UUID;
  name: string;
  status?: string | null;
  area_id?: UUID | null;
}

export interface TimelogTaskSummary {
  id: UUID;
  content: string;
  vision_id: UUID | null;
  status?: string;
  vision_summary?: VisionSummary | null;
}

export interface Timelog {
  id: UUID;
  title: string;
  start_time: string;
  end_time: string;
  area_id: UUID | null;
  task_id?: UUID | null;
  area_summary?: AreaSummary | null;
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
  task?: TimelogTaskSummary | null;
  linked_notes?: NoteSummary[];
  linked_notes_count?: number;
}

export interface TimelogCreate {
  title: string;
  start_time: string;
  end_time: string;
  area_id: UUID | null;
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

export type TimelogUpdate = Partial<TimelogCreate>;

interface EnergyInjectionResult {
  vision_id: UUID;
  experience_gained: number;
  stage_evolved: boolean;
  new_stage: number;
  total_experience: number;
}

export interface TimelogWithEnergyResponse extends Timelog {
  energy_injections?: EnergyInjectionResult[];
}

export interface TimelogAdvancedSearchRequest {
  start_date: string;
  end_date?: string;
  area_id?: UUID | null;
  without_area?: boolean;
  area_name?: string | null;
  description_keyword?: string | null;
  task_id?: UUID | null;
  without_task?: boolean;
}

export interface TimelogAdvancedSearchMetadata {
  start_date?: string | null;
  end_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  tracking_method?: string | null;
  area_id?: UUID | null;
  without_area?: boolean | null;
  area_name?: string | null;
  description_keyword?: string | null;
  task_id?: UUID | null;
  without_task?: boolean | null;
  limit?: number | null;
  returned_count?: number | null;
  total_count?: number | null;
  truncated?: boolean | null;
}

export type TimelogListResponse = ListResponse<
  Timelog,
  TimelogAdvancedSearchMetadata
>;

export type TimelogAdvancedSearchResponse = TimelogListResponse;

const TIMELOG_PAGE_SIZE = 500;
const MAX_TIMELOG_RANGE_PAGES = 100;

function toTimelogPayload(
  payload: TimelogCreate | TimelogUpdate,
): Record<string, unknown> {
  return {
    title: payload.title,
    start_time: payload.start_time,
    end_time: payload.end_time,
    tracking_method: payload.tracking_method ?? "manual",
    location: payload.location,
    energy_level: payload.energy_level,
    notes: payload.notes,
    area_id: payload.area_id,
    task_id: payload.task_id,
    person_ids: payload.person_ids,
  };
}

export const timelogsApi = {
  fetchRange: async (start: string, end: string, trackingMethod?: string) => {
    const items: Timelog[] = [];
    let firstResponse: TimelogListResponse | null = null;
    let page = 1;
    let totalCount = 0;
    let totalPages = 0;

    while (page <= MAX_TIMELOG_RANGE_PAGES) {
      const response = await http.get<TimelogListResponse>(
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

  create: (payload: TimelogCreate) => {
    const cleanedData = DataCleaner.create(toTimelogPayload(payload));
    return http.post<TimelogWithEnergyResponse>(
      ENDPOINTS.TIMELOGS.BASE,
      cleanedData,
    );
  },

  batchCreate: (timelogs: TimelogCreate[]) => {
    const cleanedTimelogs = timelogs.map((timelog) =>
      DataCleaner.create(toTimelogPayload(timelog)),
    );

    return Promise.all(
      cleanedTimelogs.map((timelog) =>
        http.post<Timelog>(ENDPOINTS.TIMELOGS.BASE, timelog),
      ),
    ).then((createdTimelogs) => ({
      created_count: createdTimelogs.length,
      failed_count: 0,
      created_timelogs: createdTimelogs,
      errors: [],
    }));
  },

  update: (id: UUID, payload: TimelogUpdate) => {
    const cleanedData = DataCleaner.update(toTimelogPayload(payload));

    return http.patch<Timelog>(
      ENDPOINTS.TIMELOGS.BY_ID(id),
      cleanedData,
    );
  },

  quickEnd: (id: UUID) =>
    http.patch<Timelog>(ENDPOINTS.TIMELOGS.BY_ID(id), {
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

  advancedSearch: async (params: TimelogAdvancedSearchRequest) => {
    const withoutArea =
      params.without_area ?? params.area_id === null;
    const withoutTask =
      params.without_task ?? params.task_id === null;
    const response = await http.get<TimelogAdvancedSearchResponse>(
      ENDPOINTS.TIMELOGS.BASE,
      {
        window_start: params.start_date,
        window_end: params.end_date,
        query: params.description_keyword ?? undefined,
        area_id: withoutArea
          ? undefined
          : (params.area_id ?? undefined),
        without_area: withoutArea || undefined,
        area_name: params.area_name ?? undefined,
        task_id: withoutTask ? undefined : (params.task_id ?? undefined),
        without_task: withoutTask || undefined,
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
        area_id:
          response.meta?.area_id ?? params.area_id ?? null,
        without_area:
          response.meta?.without_area ?? withoutArea,
        area_name:
          response.meta?.area_name ?? params.area_name ?? null,
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
    timelog_ids: UUID[];
    update_type: "persons" | "title" | "task" | "area";
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
    area?: {
      area_id: UUID | null;
    };
  }) =>
    http.post<{
      updated_count: number;
      unchanged_ids?: UUID[];
      failed_ids: UUID[];
      errors: string[];
    }>(ENDPOINTS.TIMELOGS.BATCH_UPDATE, params),
};
