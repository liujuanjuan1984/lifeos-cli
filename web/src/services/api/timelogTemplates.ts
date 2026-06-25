import type { UUID } from "@/types/primitive";
import type { PersonSummary } from "./types/common";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface TimelogTemplate {
  id: UUID;
  title: string;
  area_id: UUID | null;
  area_name?: string | null;
  area_color?: string | null;
  person_ids: UUID[];
  people: PersonSummary[];
  default_duration_minutes?: number | null;
  position: number;
  usage_count: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface TimelogTemplatesListMeta {
  order_by?: "position" | "usage" | "recent" | null;
}

export type TimelogTemplatesListResponse = ListResponse<
  TimelogTemplate,
  TimelogTemplatesListMeta
>;

export interface TimelogTemplateCreateRequest {
  title: string;
  area_id?: UUID | null;
  person_ids?: UUID[] | null;
  default_duration_minutes?: number | null;
  position?: number | null;
  usage_count?: number;
  last_used_at?: string | null;
}

export interface TimelogTemplateUpdateRequest {
  title?: string;
  area_id?: UUID | null;
  person_ids?: UUID[] | null;
  default_duration_minutes?: number | null;
  position?: number | null;
  usage_count?: number;
  last_used_at?: string | null;
}

export interface TimelogTemplateReorderItem {
  id: UUID;
  position: number;
}

export const timelogTemplatesApi = {
  list: (params?: {
    page?: number;
    size?: number;
    order_by?: "position" | "usage" | "recent";
  }): Promise<TimelogTemplatesListResponse> =>
    http.get<TimelogTemplatesListResponse>(ENDPOINTS.TIMELOGS.TEMPLATES.BASE, {
      page: params?.page,
      size: params?.size,
      order_by: params?.order_by,
    }),
  create: (payload: TimelogTemplateCreateRequest): Promise<TimelogTemplate> =>
    http.post<TimelogTemplate>(ENDPOINTS.TIMELOGS.TEMPLATES.BASE, payload),
  bulkCreate: (
    items: TimelogTemplateCreateRequest[],
  ): Promise<TimelogTemplatesListResponse> =>
    http.post<TimelogTemplatesListResponse>(ENDPOINTS.TIMELOGS.TEMPLATES.BULK, {
      items,
    }),
  update: (
    id: UUID,
    payload: TimelogTemplateUpdateRequest,
  ): Promise<TimelogTemplate> =>
    http.patch<TimelogTemplate>(
      ENDPOINTS.TIMELOGS.TEMPLATES.BY_ID(id),
      payload,
    ),
  remove: (id: UUID): Promise<void> =>
    http.delete<void>(ENDPOINTS.TIMELOGS.TEMPLATES.BY_ID(id)),
  reorder: (items: TimelogTemplateReorderItem[]): Promise<void> =>
    http.patch<void>(ENDPOINTS.TIMELOGS.TEMPLATES.REORDER, { items }),
  bumpUsage: (id: UUID): Promise<TimelogTemplate> =>
    http.post<TimelogTemplate>(ENDPOINTS.TIMELOGS.TEMPLATES.BUMP_USAGE(id)),
};
