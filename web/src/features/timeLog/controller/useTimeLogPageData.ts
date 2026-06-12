import { useEffect, useMemo, useState } from "react";
import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";
import { resolvePreferredTimezone } from "@/utils/datetime";
import { useTimeLogData } from "@/features/timeLog/controller/useTimeLogData";
import { useAdvancedSearchWithPagination } from "@/hooks/queries/useAdvancedSearch";
import { useAllTasks } from "@/hooks/queries/useTasks";
import { useDimensions } from "@/hooks/queries/useDimensions";
import { createDateBoundaries } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";
import type { Task as ApiTask } from "@/services/api";
import type { QueryMode } from "@/hooks/useQueryMode";

interface TimeLogPageDataOptions {
  selectedDate: Date;
  sortOrder: "asc" | "desc";
  queryMode: QueryMode;
  saveScrollPosition: (position: number) => void;
}

type TimeLogDataResult = ReturnType<typeof useTimeLogData>;

export interface TimeLogPageData extends TimeLogDataResult {
  timezonePreference: ReturnType<typeof usePreferenceWithBootstrap<string>>;
  activeTimezone: string;
  advancedSearchParams: {
    start_date: string;
    end_date: string;
    dimension_id: UUID | null | undefined;
    dimension_name: string | null;
    description_keyword: string | null;
    task_id: UUID | null | undefined;
  };
  setAdvancedSearchParams: React.Dispatch<
    React.SetStateAction<{
      start_date: string;
      end_date: string;
      dimension_id: UUID | null | undefined;
      dimension_name: string | null;
      description_keyword: string | null;
      task_id: UUID | null | undefined;
    }>
  >;
  advancedSearch: ReturnType<typeof useAdvancedSearchWithPagination>;
  tasksForAdvancedSearch: Array<{ id: UUID; name: string }>;
  allFlatTasks: ApiTask[];
  dimsFromCache: ReturnType<typeof useDimensions>["dimensions"];
  dimensionMap: ReturnType<typeof useDimensions>["dimensionMap"];
}

export function useTimeLogPageData(
  options: TimeLogPageDataOptions,
): TimeLogPageData {
  const { selectedDate, sortOrder, queryMode, saveScrollPosition } = options;

  const timezonePreference = usePreferenceWithBootstrap<string>({
    key: "system.timezone",
    defaultValue: resolvePreferredTimezone(),
    module: "system",
    validator: (value) => typeof value === "string" && value.length > 0,
  });

  const activeTimezone = resolvePreferredTimezone(timezonePreference.value);

  const timeLogData = useTimeLogData({
    selectedDate,
    sortOrder,
    queryMode,
    saveScrollPosition,
    timezone: activeTimezone,
  });

  const [advancedSearchParams, setAdvancedSearchParams] = useState(() => {
    const { startOfDay, endOfDay } = createDateBoundaries(
      selectedDate,
      activeTimezone,
    );
    return {
      start_date: startOfDay.toISOString(),
      end_date: endOfDay.toISOString(),
      dimension_id: undefined as UUID | null | undefined,
      dimension_name: null as string | null,
      description_keyword: null as string | null,
      task_id: undefined as UUID | null | undefined,
    };
  });

  useEffect(() => {
    setAdvancedSearchParams((prev) => {
      const startDate = new Date(prev.start_date);
      const endDate = new Date(prev.end_date);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return prev;
      }

      const { startOfDay, endOfDay } = createDateBoundaries(
        startDate,
        activeTimezone,
      );
      return {
        ...prev,
        start_date: startOfDay.toISOString(),
        end_date: endOfDay.toISOString(),
      };
    });
  }, [activeTimezone]);

  const advancedSearch = useAdvancedSearchWithPagination(100);

  const { data: allFlatTasksData } = useAllTasks({
    excludeStatus: ["done", "cancelled"],
    enabled: queryMode === "advanced",
  });
  const allFlatTasks = useMemo(
    () => (allFlatTasksData ? (allFlatTasksData as ApiTask[]) : []),
    [allFlatTasksData],
  );

  const tasksForAdvancedSearch = useMemo(
    () =>
      allFlatTasks.map((task) => ({
        id: task.id,
        name: task.content,
      })),
    [allFlatTasks],
  );

  const { dimensions: dimsFromCache, dimensionMap } = useDimensions();

  return {
    ...timeLogData,
    timezonePreference,
    activeTimezone,
    advancedSearchParams,
    setAdvancedSearchParams,
    advancedSearch,
    tasksForAdvancedSearch,
    allFlatTasks,
    dimsFromCache,
    dimensionMap,
  };
}
