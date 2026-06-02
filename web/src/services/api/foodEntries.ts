import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface FoodEntry {
  id: UUID;
  date: string;
  consumed_at: string;
  meal_type: string;
  food_id: UUID;
  portion_size_g: number;
  notes?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  created_at: string;
  updated_at: string;
  food: {
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
  };
}

export interface FoodEntryCreate {
  date: string;
  consumed_at: string;
  meal_type: string;
  food_id: UUID;
  portion_size_g: number;
  notes?: string;
}

export interface FoodEntryUpdate {
  date?: string;
  consumed_at?: string;
  meal_type?: string;
  food_id?: UUID;
  portion_size_g?: number;
  notes?: string;
}

export interface FoodEntrySummary {
  id: UUID;
  date: string;
  consumed_at: string;
  meal_type: string;
  food_name: string;
  portion_size_g: number;
  calories?: number;
  notes?: string;
}

export interface FoodEntryListMeta {
  start_date?: string | null;
  end_date?: string | null;
  meal_type?: string | null;
}

export type FoodEntryListResponse = ListResponse<
  FoodEntrySummary,
  FoodEntryListMeta
>;

export interface DailyNutritionSummary {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  total_sugar: number;
  total_sodium: number;
  entry_count: number;
}

export const foodEntriesApi = {
  // Get list of food entries with optional filtering
  getFoodEntries: async (params?: {
    start_date?: string;
    end_date?: string;
    meal_type?: string;
    page?: number;
    size?: number;
  }): Promise<FoodEntryListResponse> => {
    return http.get<FoodEntryListResponse>(ENDPOINTS.FOOD_ENTRIES.BASE, params);
  },

  // Get a specific food entry by ID
  getFoodEntry: async (id: UUID): Promise<FoodEntry> => {
    return http.get<FoodEntry>(ENDPOINTS.FOOD_ENTRIES.BY_ID(id));
  },

  // Create a new food entry
  createFoodEntry: async (entry: FoodEntryCreate): Promise<FoodEntry> => {
    return http.post<FoodEntry>(ENDPOINTS.FOOD_ENTRIES.BASE, entry);
  },

  // Update an existing food entry
  updateFoodEntry: async (
    id: UUID,
    entry: FoodEntryUpdate,
  ): Promise<FoodEntry> => {
    return http.put<FoodEntry>(ENDPOINTS.FOOD_ENTRIES.BY_ID(id), entry);
  },

  // Delete a food entry
  deleteFoodEntry: async (id: UUID): Promise<void> => {
    return http.delete(ENDPOINTS.FOOD_ENTRIES.BY_ID(id));
  },

  // Get daily nutrition summary
  getDailyNutritionSummary: async (
    date: string,
  ): Promise<DailyNutritionSummary> => {
    return http.get<DailyNutritionSummary>(
      ENDPOINTS.FOOD_ENTRIES.DAILY_SUMMARY(date),
    );
  },
};
