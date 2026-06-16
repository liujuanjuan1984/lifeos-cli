import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface Area {
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

export interface AreaCreate {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
}

export interface AreaUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

interface AreaListMeta {
  include_inactive?: boolean | null;
}

export type AreaListResponse = ListResponse<Area, AreaListMeta>;

export const areasApi = {
  async getAreas(
    includeInactive: boolean = false,
    page: number = 1,
    size: number = 100,
  ): Promise<AreaListResponse> {
    return http.get<AreaListResponse>(ENDPOINTS.AREAS.BASE, {
      include_inactive: includeInactive,
      page,
      size,
    });
  },
  getArea: (id: UUID): Promise<Area> =>
    http.get<Area>(ENDPOINTS.AREAS.BY_ID(id)),
  createArea: (area: AreaCreate): Promise<Area> =>
    http.post<Area>(ENDPOINTS.AREAS.BASE, area),
  updateArea: (
    id: UUID,
    area: AreaUpdate,
  ): Promise<Area> =>
    http.patch<Area>(ENDPOINTS.AREAS.BY_ID(id), area),
  deleteArea: (id: UUID): Promise<void> =>
    http.delete<void>(ENDPOINTS.AREAS.BY_ID(id)),
  activateArea: (id: UUID): Promise<Area> =>
    http.post<Area>(ENDPOINTS.AREAS.ACTIVATE(id)),
  getOrder: async (): Promise<UUID[]> =>
    http.get<UUID[]>(ENDPOINTS.AREAS.ORDER),
  setOrder: async (order: UUID[]): Promise<void> =>
    http.put<void>(ENDPOINTS.AREAS.ORDER, order),
  resetOrder: async (): Promise<void> =>
    http.delete<void>(ENDPOINTS.AREAS.ORDER),
};
