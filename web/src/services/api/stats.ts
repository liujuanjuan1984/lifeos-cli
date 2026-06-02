import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";

export interface DailyDimensionRow {
  date: string;
  dimension_id: UUID;
  minutes: number;
}

export type AggregationGranularity = "day" | "week" | "month" | "year";

export interface AggregatedDimensionRow {
  granularity: AggregationGranularity;
  period_start: string;
  period_end: string;
  dimension_id: UUID;
  minutes: number;
}

export interface DailyDimensionStatsMeta {
  start?: string | null;
  end?: string | null;
  timezone?: string | null;
  dimension_ids?: string[] | null;
}

export type DailyDimensionListResponse = ListResponse<
  DailyDimensionRow,
  DailyDimensionStatsMeta
>;

export interface AggregatedDimensionStatsMeta {
  granularity?: AggregationGranularity | null;
  start?: string | null;
  end?: string | null;
  timezone?: string | null;
  dimension_ids?: string[] | null;
  first_day_of_week?: number | null;
  calendar_system?: string | null;
}

export type AggregatedDimensionListResponse = ListResponse<
  AggregatedDimensionRow,
  AggregatedDimensionStatsMeta
>;

export interface DayBreakdownRow {
  dimension_id: UUID;
  minutes: number;
}

export interface DayBreakdownMeta {
  day?: string | null;
  timezone?: string | null;
}

export type DayBreakdownListResponse = ListResponse<
  DayBreakdownRow,
  DayBreakdownMeta
>;

export const statsApi = {
  async getDailyDimensions(
    start: string,
    end: string,
    dimensionIds?: UUID[],
    timezone?: string,
  ) {
    return http.get<DailyDimensionListResponse>("/api/v1/stats/daily-dimensions", {
      start,
      end,
      timezone,
      dimension_ids: dimensionIds,
    });
  },
  async getLocalDayBreakdown(day: string, timezone?: string) {
    return http.get<DayBreakdownListResponse>("/api/v1/stats/day-breakdown", {
      day,
      timezone,
    });
  },
  async getAggregatedDimensions(
    granularity: AggregationGranularity,
    start: string,
    end: string,
    options?: {
      dimensionIds?: UUID[];
      timezone?: string;
      firstDayOfWeek?: number;
      calendarSystem?: string;
    },
  ) {
    return http.get<AggregatedDimensionListResponse>(
      "/api/v1/stats/aggregated-dimensions",
      {
        granularity,
        start,
        end,
        timezone: options?.timezone,
        dimension_ids: options?.dimensionIds,
        first_day_of_week: options?.firstDayOfWeek,
        calendar_system: options?.calendarSystem,
      },
    );
  },
  async recomputeDailyDimensions(
    start: string,
    end: string,
    timezone?: string,
  ) {
    return http.post<{ days_recomputed: number }>(
      "/api/v1/stats/daily-dimensions/recompute",
      undefined,
      { start, end, timezone },
    );
  },
};
