import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface Dimension {
  id: UUID;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  display_order?: number;
  created_at: string;
  updated_at: string;
}

export interface DimensionCreate {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
}

export interface DimensionUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface DimensionListMeta {
  include_inactive?: boolean | null;
}

export type DimensionListResponse = ListResponse<Dimension, DimensionListMeta>;

export const dimensionsApi = {
  async getDimensions(
    includeInactive: boolean = false,
    page: number = 1,
    size: number = 100,
  ): Promise<DimensionListResponse> {
    return http.get<DimensionListResponse>(ENDPOINTS.DIMENSIONS.BASE, {
      include_inactive: includeInactive,
      page,
      size,
    });
  },
  getDimension: (id: UUID): Promise<Dimension> =>
    http.get<Dimension>(ENDPOINTS.DIMENSIONS.BY_ID(id)),
  createDimension: (dimension: DimensionCreate): Promise<Dimension> =>
    http.post<Dimension>(ENDPOINTS.DIMENSIONS.BASE, dimension),
  updateDimension: (
    id: UUID,
    dimension: DimensionUpdate,
  ): Promise<Dimension> =>
    http.patch<Dimension>(ENDPOINTS.DIMENSIONS.BY_ID(id), dimension),
  deleteDimension: (id: UUID): Promise<void> =>
    http.delete<void>(ENDPOINTS.DIMENSIONS.BY_ID(id)),
  activateDimension: (id: UUID): Promise<Dimension> =>
    http.post<Dimension>(ENDPOINTS.DIMENSIONS.ACTIVATE(id)),
  getOrder: async (): Promise<UUID[]> =>
    http.get<UUID[]>(ENDPOINTS.DIMENSIONS.ORDER),
  setOrder: async (order: UUID[]): Promise<void> =>
    http.put<void>(ENDPOINTS.DIMENSIONS.ORDER, order),
  resetOrder: async (): Promise<void> =>
    http.delete<void>(ENDPOINTS.DIMENSIONS.ORDER),
};
