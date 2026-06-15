import type { UUID } from "@/types/primitive";
import type { PersonSummary } from "./types/common";
import type { ListResponse } from "@/types/pagination";

export interface TimelogTemplate {
  id: UUID;
  user_id: UUID;
  title: string;
  area_id: UUID | null;
  area_name?: string | null;
  area_color?: string | null;
  person_ids: UUID[];
  persons: PersonSummary[];
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

const unsupported = () =>
  Promise.reject(new Error("Quick time-entry templates are not supported yet."));

export const timelogTemplatesApi = {
  list: async (params?: {
    page?: number;
    size?: number;
    order_by?: "position" | "usage" | "recent";
  }): Promise<TimelogTemplatesListResponse> => ({
    items: [],
    pagination: {
      page: params?.page ?? 1,
      size: params?.size ?? 100,
      total: 0,
      pages: 0,
    },
    meta: { order_by: params?.order_by ?? null },
  }),
  create: (
    _payload: TimelogTemplateCreateRequest,
  ): Promise<TimelogTemplate> => unsupported(),
  bulkCreate: async (
    _items: TimelogTemplateCreateRequest[],
  ): Promise<TimelogTemplatesListResponse> => ({
    items: [],
    pagination: { page: 1, size: 100, total: 0, pages: 0 },
    meta: {},
  }),
  update: (
    _id: UUID,
    _payload: TimelogTemplateUpdateRequest,
  ): Promise<TimelogTemplate> => unsupported(),
  remove: (_id: UUID): Promise<void> => unsupported(),
  reorder: async (_items: TimelogTemplateReorderItem[]): Promise<void> =>
    undefined,
  bumpUsage: (_id: UUID): Promise<TimelogTemplate> => unsupported(),
};
