import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

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
  getAll: async (params?: {
    entity_type?: string;
    category?: string;
    page?: number;
    size?: number;
  }): Promise<TagListResponse> => ({
    items: [],
    pagination: {
      page: params?.page ?? 1,
      size: params?.size ?? 100,
      total: 0,
      pages: 0,
    },
    meta: {
      entity_type: params?.entity_type ?? null,
      category: params?.category ?? null,
    },
  }),
  getEntityTypes: async (): Promise<string[]> => [],
  getCategories: async (_entityType: string): Promise<TagCategoryOption[]> => [],
  createCategory: (
    _payload: TagCategoryCreate,
    _entityType: string,
  ): Promise<TagCategoryOption> => unsupported(),
  renameCategory: (
    _value: string,
    _payload: TagCategoryUpdate,
    _entityType: string,
  ): Promise<TagCategoryOption> => unsupported(),
  create: (_tag: TagCreate): Promise<Tag> => unsupported(),
  getById: (_id: UUID): Promise<Tag> => unsupported(),
  update: (_id: UUID, _tag: TagUpdate): Promise<Tag> => unsupported(),
  bulkUpdateCategories: (
    _payload: TagBulkUpdateRequest,
  ): Promise<TagBulkUpdateResponse> => unsupported(),
  delete: (_id: UUID): Promise<void> => unsupported(),
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
