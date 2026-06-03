import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface Tag {
  id: UUID;
  name: string;
  entity_type: string;
  category: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TagCreate {
  name: string;
  entity_type?: string;
  category?: string;
  description?: string;
  color?: string;
}

export interface TagUpdate {
  name?: string;
  entity_type?: string;
  category?: string;
  description?: string;
  color?: string;
}

export interface TagUsageStats {
  tag_id: UUID;
  tag_name: string;
  entity_type: string;
  category: string;
  usage_by_entity_type: Record<string, number>;
  total_usage: number;
}

export interface TagCategoryOption {
  value: string;
  label: string;
  entity_type?: string | null;
}

export interface TagCategoryCreate {
  label: string;
  value?: string;
}

export interface TagCategoryUpdate {
  label: string;
}

export interface TagBulkUpdateRequest {
  ids: UUID[];
  category: string;
}

export interface TagBulkUpdateResponse {
  updated_count: number;
  failed_ids: UUID[];
  errors: string[];
  updated_tags: Tag[];
}

export interface TagListMeta {
  entity_type?: string | null;
  category?: string | null;
}

export type TagListResponse = ListResponse<Tag, TagListMeta>;

const unsupported = () =>
  Promise.reject(new Error("Tags are not supported by LifeOS Web UI yet."));

export const tagsApi = {
  getAll: (params?: {
    entity_type?: string;
    category?: string;
    page?: number;
    size?: number;
  }): Promise<TagListResponse> => http.get<TagListResponse>(ENDPOINTS.TAGS.BASE, params),
  getEntityTypes: (): Promise<string[]> =>
    http.get<string[]>(ENDPOINTS.TAGS.ENTITY_TYPES),
  getCategories: (entityType: string): Promise<TagCategoryOption[]> =>
    http.get<TagCategoryOption[]>(ENDPOINTS.TAGS.CATEGORIES, {
      entity_type: entityType,
    }),
  createCategory: (
    _payload: TagCategoryCreate,
    _entityType: string,
  ): Promise<TagCategoryOption> => unsupported(),
  renameCategory: (
    _value: string,
    _payload: TagCategoryUpdate,
    _entityType: string,
  ): Promise<TagCategoryOption> => unsupported(),
  create: (tag: TagCreate): Promise<Tag> =>
    http.post<Tag>(ENDPOINTS.TAGS.BASE, tag),
  getById: (id: UUID): Promise<Tag> => http.get<Tag>(ENDPOINTS.TAGS.BY_ID(id)),
  update: (id: UUID, tag: TagUpdate): Promise<Tag> =>
    http.patch<Tag>(ENDPOINTS.TAGS.BY_ID(id), tag),
  bulkUpdateCategories: (
    _payload: TagBulkUpdateRequest,
  ): Promise<TagBulkUpdateResponse> => unsupported(),
  delete: (id: UUID): Promise<void> => http.delete<void>(ENDPOINTS.TAGS.BY_ID(id)),
  getUsage: (id: UUID): Promise<TagUsageStats> =>
    Promise.resolve({
      tag_id: id,
      tag_name: "",
      entity_type: "",
      category: "",
      usage_by_entity_type: {},
      total_usage: 0,
    }),
  getStatsBatch: async (entityType: string) => ({
    entity_type: entityType,
    tag_stats: [] as Array<{ id: UUID; name: string; usage_count: number }>,
    total_tags: 0,
  }),
};
