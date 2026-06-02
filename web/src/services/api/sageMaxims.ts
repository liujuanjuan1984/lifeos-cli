import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export type SageMaximSort = "random" | "latest" | "top";
export type SageMaximReaction = "like" | "dislike";

export interface SageMaxim {
  id: UUID;
  content: string;
  language: string;
  like_count: number;
  dislike_count: number;
  created_at: string;
  updated_at: string;
  author: {
    id: UUID;
    name: string;
  };
  viewer_reaction?: SageMaximReaction | null;
}

export interface SageMaximListMeta {
  sort?: SageMaximSort | null;
}

export type SageMaximListResponse = ListResponse<SageMaxim, SageMaximListMeta>;

export interface CreateSageMaximPayload {
  content: string;
  language?: string;
}

const unsupported = () =>
  Promise.reject(new Error("Sage maxims are not supported by LifeOS Web UI yet."));

export const sageMaximsApi = {
  list: async (params: {
    sort?: SageMaximSort;
    page?: number;
    size?: number;
  }): Promise<SageMaximListResponse> => ({
    items: [],
    pagination: {
      page: params.page ?? 1,
      size: params.size ?? 50,
      total: 0,
      pages: 0,
    },
    meta: { sort: params.sort ?? null },
  }),
  create: (_payload: CreateSageMaximPayload): Promise<SageMaxim> =>
    unsupported(),
  react: (_maximId: UUID, _action: SageMaximReaction): Promise<SageMaxim> =>
    unsupported(),
  removeReaction: (_maximId: UUID): Promise<SageMaxim> => unsupported(),
};
