import type { UUID } from "@/types/primitive";
import type { PersonSummary } from "./types/common";
import type { ListResponse } from "@/types/pagination";

export interface ActualEventTemplate {
  id: UUID;
  user_id: UUID;
  title: string;
  dimension_id: UUID | null;
  dimension_name?: string | null;
  dimension_color?: string | null;
  person_ids: UUID[];
  persons: PersonSummary[];
  default_duration_minutes?: number | null;
  position: number;
  usage_count: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActualEventTemplatesListMeta {
  order_by?: "position" | "usage" | "recent" | null;
}

export type ActualEventTemplatesListResponse = ListResponse<
  ActualEventTemplate,
  ActualEventTemplatesListMeta
>;

export interface ActualEventTemplateCreateRequest {
  title: string;
  dimension_id?: UUID | null;
  person_ids?: UUID[] | null;
  default_duration_minutes?: number | null;
  position?: number | null;
  usage_count?: number;
  last_used_at?: string | null;
}

export interface ActualEventTemplateUpdateRequest {
  title?: string;
  dimension_id?: UUID | null;
  person_ids?: UUID[] | null;
  default_duration_minutes?: number | null;
  position?: number | null;
  usage_count?: number;
  last_used_at?: string | null;
}

export interface ActualEventTemplateReorderItem {
  id: UUID;
  position: number;
}

const unsupported = () =>
  Promise.reject(new Error("Quick time-entry templates are not supported yet."));

export const actualEventTemplatesApi = {
  list: async (params?: {
    page?: number;
    size?: number;
    order_by?: "position" | "usage" | "recent";
  }): Promise<ActualEventTemplatesListResponse> => ({
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
    _payload: ActualEventTemplateCreateRequest,
  ): Promise<ActualEventTemplate> => unsupported(),
  bulkCreate: async (
    _items: ActualEventTemplateCreateRequest[],
  ): Promise<ActualEventTemplatesListResponse> => ({
    items: [],
    pagination: { page: 1, size: 100, total: 0, pages: 0 },
    meta: {},
  }),
  update: (
    _id: UUID,
    _payload: ActualEventTemplateUpdateRequest,
  ): Promise<ActualEventTemplate> => unsupported(),
  remove: (_id: UUID): Promise<void> => unsupported(),
  reorder: async (_items: ActualEventTemplateReorderItem[]): Promise<void> =>
    undefined,
  bumpUsage: (_id: UUID): Promise<ActualEventTemplate> => unsupported(),
};
