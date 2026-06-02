import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface Food {
  id: UUID;
  name: string;
  description?: string;
  is_common: boolean;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
  created_at: string;
  updated_at: string;
}

export interface FoodCreate {
  name: string;
  description?: string;
  is_common: boolean;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
}

export interface FoodUpdate {
  name?: string;
  description?: string;
  is_common?: boolean;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
}

export interface FoodSummary {
  id: UUID;
  name: string;
  is_common: boolean;
  calories_per_100g?: number;
}

export interface FoodListMeta {
  search?: string | null;
  common_only?: boolean | null;
}

export type FoodListResponse = ListResponse<FoodSummary, FoodListMeta>;

export const foodsApi = {
  // Get list of foods with optional filtering
  getFoods: async (params?: {
    search?: string;
    common_only?: boolean;
    page?: number;
    size?: number;
  }): Promise<FoodListResponse> => {
    return http.get<FoodListResponse>(ENDPOINTS.FOODS.BASE, params);
  },

  // Get a specific food by ID
  getFood: async (id: UUID): Promise<Food> => {
    return http.get<Food>(ENDPOINTS.FOODS.BY_ID(id));
  },

  // Create a new food item
  createFood: async (food: FoodCreate): Promise<Food> => {
    return http.post<Food>(ENDPOINTS.FOODS.BASE, food);
  },

  // Update an existing food item
  updateFood: async (id: UUID, food: FoodUpdate): Promise<Food> => {
    return http.put<Food>(ENDPOINTS.FOODS.BY_ID(id), food);
  },

  // Delete a food item
  deleteFood: async (id: UUID): Promise<void> => {
    return http.delete(ENDPOINTS.FOODS.BY_ID(id));
  },
};
