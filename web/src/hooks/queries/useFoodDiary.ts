import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  foodEntriesApi,
  type FoodEntrySummary,
  type DailyNutritionSummary,
  type FoodEntryCreate,
  type FoodEntryUpdate,
  type FoodEntry,
} from "@/services/api/foodEntries";
import { foodEntriesKeys } from "@/services/api/queryKeys";
import { useToast } from "@/contexts/ToastContext";
import type { UUID } from "@/types/primitive";
import {
  invalidateDailyNutrition,
  invalidateFoodEntryListByDate,
  removeFoodEntryDetailCache,
} from "@/services/api/cacheInvalidation/foodEntries";

interface UseFoodDiaryFilters {
  selectedDate: string;
}

interface UseFoodDiaryReturn {
  // Data
  foodEntries: FoodEntrySummary[];
  dailyNutrition: DailyNutritionSummary | null;

  // Loading states
  isLoading: boolean;
  isLoadingNutrition: boolean;

  // Error states
  error: Error | null;
  nutritionError: Error | null;

  // Actions
  createFoodEntry: (entry: FoodEntryCreate) => void;
  updateFoodEntry: (id: UUID, entry: FoodEntryUpdate) => void;
  deleteFoodEntry: (id: UUID) => void;
  refreshData: () => void;

  // Mutations
  createFoodEntryMutation: ReturnType<
    typeof useMutation<FoodEntry, Error, FoodEntryCreate>
  >;
  updateFoodEntryMutation: ReturnType<
    typeof useMutation<FoodEntry, Error, { id: UUID; entry: FoodEntryUpdate }>
  >;
  deleteFoodEntryMutation: ReturnType<typeof useMutation<void, Error, UUID>>;
}

export function useFoodDiary(filters: UseFoodDiaryFilters): UseFoodDiaryReturn {
  const queryClient = useQueryClient();
  const toast = useToast();
  const page = 1;
  const size = 100;

  // 1. 获取食物条目列表
  const {
    data: foodEntriesRaw,
    isLoading: isLoadingEntries,
    error: entriesError,
  } = useQuery({
    queryKey: foodEntriesKeys.list({
      start_date: filters.selectedDate,
      end_date: filters.selectedDate,
      page,
      size,
    }),
    queryFn: () =>
      foodEntriesApi.getFoodEntries({
        start_date: filters.selectedDate,
        end_date: filters.selectedDate,
        page,
        size,
      }),
  });
  const foodEntries = useMemo(
    () => foodEntriesRaw?.items ?? [],
    [foodEntriesRaw],
  );

  // 2. 获取每日营养摘要
  const {
    data: dailyNutrition = null,
    isLoading: isLoadingNutrition,
    error: nutritionError,
  } = useQuery({
    queryKey: foodEntriesKeys.dailyNutrition(filters.selectedDate),
    queryFn: () =>
      foodEntriesApi.getDailyNutritionSummary(filters.selectedDate),
  });

  // 3. 创建食物条目
  const createFoodEntryMutation = useMutation({
    mutationFn: (entry: FoodEntryCreate) =>
      foodEntriesApi.createFoodEntry(entry),
    onSuccess: async (created) => {
      toast.showSuccess("食物记录创建成功！");
      queryClient.setQueryData(foodEntriesKeys.detail(created.id), created);
      await Promise.all([
        invalidateFoodEntryListByDate(
          queryClient,
          filters.selectedDate,
          filters.selectedDate,
          page,
          size,
        ),
        invalidateDailyNutrition(queryClient, filters.selectedDate),
      ]);
    },
    onError: (err: Error) => {
      toast.showError("食物记录创建失败", err.message);
    },
  });

  // 4. 更新食物条目
  const updateFoodEntryMutation = useMutation({
    mutationFn: ({ id, entry }: { id: UUID; entry: FoodEntryUpdate }) =>
      foodEntriesApi.updateFoodEntry(id, entry),
    onSuccess: async (updated) => {
      toast.showSuccess("食物记录更新成功！");
      queryClient.setQueryData(foodEntriesKeys.detail(updated.id), updated);
      await Promise.all([
        invalidateFoodEntryListByDate(
          queryClient,
          filters.selectedDate,
          filters.selectedDate,
          page,
          size,
        ),
        invalidateDailyNutrition(queryClient, filters.selectedDate),
      ]);
    },
    onError: (err: Error) => {
      toast.showError("食物记录更新失败", err.message);
    },
  });

  // 5. 删除食物条目
  const deleteFoodEntryMutation = useMutation({
    mutationFn: (id: UUID) => foodEntriesApi.deleteFoodEntry(id),
    onSuccess: async (_, id) => {
      toast.showSuccess("食物记录删除成功！");
      removeFoodEntryDetailCache(queryClient, id);
      await Promise.all([
        invalidateFoodEntryListByDate(
          queryClient,
          filters.selectedDate,
          filters.selectedDate,
          page,
          size,
        ),
        invalidateDailyNutrition(queryClient, filters.selectedDate),
      ]);
    },
    onError: (err: Error) => {
      toast.showError("食物记录删除失败", err.message);
    },
  });

  // 6. 创建食物条目
  const createFoodEntry = (entry: FoodEntryCreate) => {
    createFoodEntryMutation.mutate(entry);
  };

  // 7. 更新食物条目
  const updateFoodEntry = (id: UUID, entry: FoodEntryUpdate) => {
    updateFoodEntryMutation.mutate({ id, entry });
  };

  // 8. 删除食物条目
  const deleteFoodEntry = (id: UUID) => {
    deleteFoodEntryMutation.mutate(id);
  };

  // 9. 刷新数据
  const refreshData = () => {
    void Promise.all([
      invalidateFoodEntryListByDate(
        queryClient,
        filters.selectedDate,
        filters.selectedDate,
      ),
      invalidateDailyNutrition(queryClient, filters.selectedDate),
    ]);
  };

  return {
    foodEntries,
    dailyNutrition,
    isLoading: isLoadingEntries,
    isLoadingNutrition,
    error: entriesError,
    nutritionError,
    createFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    refreshData,
    createFoodEntryMutation,
    updateFoodEntryMutation,
    deleteFoodEntryMutation,
  };
}
