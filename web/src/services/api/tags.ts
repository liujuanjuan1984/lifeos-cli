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

export type TagListFieldsMode = "selector" | "full";

interface TagListMeta {
  entity_type?: string | null;
  category?: string | null;
  fields?: TagListFieldsMode | null;
}

export type TagListResponse = ListResponse<Tag, TagListMeta>;

export const tagsApi = {
  getAll: (params?: {
    entity_type?: string;
    category?: string;
    page?: number;
    size?: number;
    fields?: TagListFieldsMode;
  }): Promise<TagListResponse> => http.get<TagListResponse>(ENDPOINTS.TAGS.BASE, params),
  getEntityTypes: (): Promise<string[]> =>
    http.get<string[]>(ENDPOINTS.TAGS.ENTITY_TYPES),
  getCategories: (entityType: string): Promise<TagCategoryOption[]> =>
    http.get<TagCategoryOption[]>(ENDPOINTS.TAGS.CATEGORIES, {
      entity_type: entityType,
    }),
  createCategory: (
    payload: TagCategoryCreate,
    entityType: string,
  ): Promise<TagCategoryOption> =>
    http.post<TagCategoryOption>(ENDPOINTS.TAGS.CATEGORIES, payload, {
      entity_type: entityType,
    }),
  renameCategory: (
    value: string,
    payload: TagCategoryUpdate,
    entityType: string,
  ): Promise<TagCategoryOption> =>
    http.patch<TagCategoryOption>(ENDPOINTS.TAGS.CATEGORY_BY_VALUE(value), payload, {
      entity_type: entityType,
    }),
  create: (tag: TagCreate): Promise<Tag> =>
    http.post<Tag>(ENDPOINTS.TAGS.BASE, tag),
  getById: (id: UUID): Promise<Tag> => http.get<Tag>(ENDPOINTS.TAGS.BY_ID(id)),
  update: (id: UUID, tag: TagUpdate): Promise<Tag> =>
    http.patch<Tag>(ENDPOINTS.TAGS.BY_ID(id), tag),
  bulkUpdateCategories: (
    payload: TagBulkUpdateRequest,
  ): Promise<TagBulkUpdateResponse> =>
    http.patch<TagBulkUpdateResponse>(ENDPOINTS.TAGS.BATCH_UPDATE, payload),
  delete: (id: UUID): Promise<void> => http.delete<void>(ENDPOINTS.TAGS.BY_ID(id)),
  getUsage: (id: UUID): Promise<TagUsageStats> =>
    http.get<TagUsageStats>(ENDPOINTS.TAGS.USAGE(id)),
  getStatsBatch: (entityType: string) =>
    http.get<{
      entity_type: string;
      tag_stats: Array<{ id: UUID; name?: string; usage_count: number }>;
      total_tags: number;
    }>(ENDPOINTS.STATS.TAGS_USAGE(entityType)),
};
