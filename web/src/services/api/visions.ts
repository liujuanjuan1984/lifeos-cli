import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { PersonSummary } from "./types/common";
import type { Task } from "./tasks";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";
// Types local to visions
export interface Vision {
  id: UUID;
  name: string;
  description?: string | null;
  area_id?: UUID | null;
  status: string;
  stage: number;
  experience_points: number;
  experience_rate_per_hour: number | null;
  created_at: string;
  people?: PersonSummary[];
  // Optional aggregated minutes for display (if backend adds later)
  total_actual_effort?: number | null;
}

export interface VisionCreate {
  name: string;
  description?: string;
  area_id?: UUID | null;
  person_ids?: UUID[];
  status?: string;
  experience_rate_per_hour?: number | null;
}

export interface VisionUpdate {
  name?: string;
  description?: string;
  status?: string;
  area_id?: UUID | null;
  person_ids?: UUID[];
  experience_rate_per_hour?: number | null;
}

export interface VisionWithTasks extends Vision {
  tasks: Task[];
}

export interface VisionStatsResponse {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
  total_estimated_effort?: number | null;
  total_actual_effort?: number | null;
}

export interface VisionExperienceRateUpdatePayload {
  id: UUID;
  experience_rate_per_hour: number | null;
}

interface VisionListMeta {
  status_filter?: string | null;
}

export type VisionListResponse = ListResponse<Vision, VisionListMeta>;

export const visionsApi = {
  async getAll(
    statusFilter?: string,
    page: number = 1,
    size: number = 100,
  ): Promise<VisionListResponse> {
    return http.get<VisionListResponse>(ENDPOINTS.VISIONS.BASE, {
      status_filter: statusFilter,
      page,
      size,
    });
  },

  async getById(id: UUID): Promise<Vision> {
    return http.get<Vision>(ENDPOINTS.VISIONS.BY_ID(id));
  },

  async getWithTasks(id: UUID): Promise<VisionWithTasks> {
    return http.get<VisionWithTasks>(ENDPOINTS.VISIONS.WITH_TASKS(id));
  },

  async create(vision: VisionCreate): Promise<Vision> {
    return http.post<Vision>(ENDPOINTS.VISIONS.BASE, vision);
  },

  async update(id: UUID, vision: VisionUpdate): Promise<Vision> {
    return http.patch<Vision>(ENDPOINTS.VISIONS.BY_ID(id), vision);
  },

  async delete(id: UUID): Promise<void> {
    return http.delete<void>(ENDPOINTS.VISIONS.BY_ID(id));
  },

  async addExperience(id: UUID, experiencePoints: number): Promise<Vision> {
    return http.post<Vision>(ENDPOINTS.VISIONS.ADD_EXPERIENCE(id), {
      experience_points: experiencePoints,
    });
  },

  async harvest(id: UUID): Promise<Vision> {
    return http.post<Vision>(ENDPOINTS.VISIONS.HARVEST(id));
  },

  async getStats(id: UUID): Promise<VisionStatsResponse> {
    return http.get<VisionStatsResponse>(ENDPOINTS.VISIONS.STATS(id));
  },

  async recomputeEfforts(
    id: UUID,
  ): Promise<{ vision_id: UUID; recomputed_roots: UUID[] }> {
    return http.post<{ vision_id: UUID; recomputed_roots: UUID[] }>(
      ENDPOINTS.VISIONS.RECOMPUTE_EFFORTS(id),
    );
  },

  async syncExperience(id: UUID): Promise<Vision> {
    return http.post<Vision>(ENDPOINTS.VISIONS.SYNC_EXPERIENCE(id));
  },

  async bulkUpdateExperienceRates(
    items: VisionExperienceRateUpdatePayload[],
  ): Promise<Vision[]> {
    const updated = await Promise.all(
      items.map((item) =>
        visionsApi.update(item.id, {
          experience_rate_per_hour: item.experience_rate_per_hour,
        }),
      ),
    );
    return updated;
  },
};
