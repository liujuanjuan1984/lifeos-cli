import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TFunction } from "i18next";
import type { QueryMode } from "@/hooks/useQueryMode";
import type {
  useAdvancedSearchWithPagination,
  AdvancedSearchParams,
} from "@/hooks/queries/useAdvancedSearch";
import type { ProcessedEntry } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";
import type { TimeLogPageData } from "./useTimeLogPageData";
import { SelectorSpecialValue } from "@/components/selects/selectorTypes";
import { createDateBoundaries } from "@/utils/datetime";
import { logger } from "@/utils/core";

interface TimeLogAdvancedInteractionsOptions {
  queryMode: QueryMode;
  setQueryMode: (mode: QueryMode) => void;
  advancedSearchParams: TimeLogPageData["advancedSearchParams"];
  setAdvancedSearchParams: TimeLogPageData["setAdvancedSearchParams"];
  advancedSearch: ReturnType<typeof useAdvancedSearchWithPagination>;
  areasFromCache: TimeLogPageData["areasFromCache"];
  sortOrder: "asc" | "desc";
  setAdvancedSearchResultsFromHook: (results: ProcessedEntry[]) => void;
  showError: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
  t: TFunction;
  processedEntries: ProcessedEntry[];
  selectedAreaId:
    | UUID
    | null
    | string
    | undefined
    | typeof SelectorSpecialValue.None;
  activeTimezone: string;
}

interface TimeLogAdvancedInteractionsReturn {
  switchToAdvancedMode: () => void;
  switchToSingleMode: () => void;
  resetAdvancedSearch: () => void;
  loadAdvancedSearchResults: () => Promise<void>;
  handleAdvancedSearch: () => void;
  filteredEntries: ProcessedEntry[];
}

export function useTimeLogAdvancedInteractions({
  queryMode,
  setQueryMode,
  advancedSearchParams,
  setAdvancedSearchParams,
  advancedSearch,
  areasFromCache,
  sortOrder,
  setAdvancedSearchResultsFromHook,
  showError,
  showInfo,
  t,
  processedEntries,
  selectedAreaId,
  activeTimezone,
}: TimeLogAdvancedInteractionsOptions): TimeLogAdvancedInteractionsReturn {
  const switchToAdvancedMode = useCallback(() => {
    setQueryMode("advanced");
    advancedSearch.clearSearch();
  }, [advancedSearch, setQueryMode]);

  const switchToSingleMode = useCallback(() => {
    setQueryMode("single");
    advancedSearch.clearSearch();
  }, [advancedSearch, setQueryMode]);

  const resetAdvancedSearch = useCallback(() => {
    const today = new Date();
    const { startOfDay, endOfDay } = createDateBoundaries(
      today,
      activeTimezone,
    );

    const resetParams = {
      start_date: startOfDay.toISOString(),
      end_date: endOfDay.toISOString(),
      area_id: undefined,
      area_name: null,
      description_keyword: null,
      task_id: undefined,
      with_task: false,
    };

    setAdvancedSearchParams(resetParams);
    advancedSearch.clearSearch();
    setAdvancedSearchResultsFromHook([]);

    showInfo(
      t("timeLog.advancedSearch.title"),
      t("timeLog.messages.queryConditionsReset"),
    );
  }, [
    activeTimezone,
    advancedSearch,
    setAdvancedSearchParams,
    setAdvancedSearchResultsFromHook,
    showInfo,
    t,
  ]);

  const buildAdvancedSearchPayload = useCallback((): AdvancedSearchParams => {
    const areaName =
      typeof advancedSearchParams.area_id === "string"
        ? areasFromCache?.find((d) => d.id === advancedSearchParams.area_id)
            ?.name || null
        : null;

    const { task_id, with_task, ...restParams } = advancedSearchParams;
    const normalizedTaskId =
      typeof task_id === "string" &&
      (task_id === SelectorSpecialValue.All || task_id === SelectorSpecialValue.Has)
        ? undefined
        : task_id;
    const shouldFilterWithTask =
      with_task || task_id === (SelectorSpecialValue.Has as unknown as UUID);

    return {
      ...restParams,
      ...(advancedSearchParams.area_id !== undefined && {
        area_id: advancedSearchParams.area_id,
      }),
      ...(normalizedTaskId !== undefined && { task_id: normalizedTaskId }),
      ...(shouldFilterWithTask && { with_task: true }),
      area_name: areaName,
      sort_order: sortOrder,
    };
  }, [advancedSearchParams, areasFromCache, sortOrder]);

  const loadAdvancedSearchResults = useCallback(async () => {
    try {
      const searchParams = buildAdvancedSearchPayload();
      advancedSearch.search(searchParams);
    } catch (err) {
      logger.error("Failed to load advanced search results:", err);
      showError(
        t("timeLog.messages.queryFailed"),
        err instanceof Error
          ? err.message
          : t("timeLog.messages.loadingAdvancedQueryFailed"),
      );
    }
  }, [advancedSearch, buildAdvancedSearchPayload, showError, t]);

  const handleAdvancedSearch = useCallback(() => {
    void loadAdvancedSearchResults();
  }, [loadAdvancedSearchResults]);

  const processedAdvancedSearchData = useMemo(() => {
    if (queryMode === "advanced" && advancedSearch.data.length > 0) {
      return advancedSearch.data.map((event) => ({
        ...event,
        validationResult: {
          isValid: true,
          hasNegativeDuration: false,
          hasOverlaps: false,
          overlappingEntries: [],
        },
        isPlaceholder: false,
      }));
    }
    return [];
  }, [advancedSearch.data, queryMode]);

  const advancedResultsRef = useRef(setAdvancedSearchResultsFromHook);
  advancedResultsRef.current = setAdvancedSearchResultsFromHook;

  useEffect(() => {
    advancedResultsRef.current(processedAdvancedSearchData);
  }, [processedAdvancedSearchData]);

  const filteredEntries = useMemo(() => {
    if (queryMode === "advanced") {
      return processedAdvancedSearchData;
    }

    if (
      selectedAreaId === null ||
      selectedAreaId === undefined ||
      selectedAreaId === ""
    )
      return processedEntries;

    const filtered = processedEntries.filter((entry) =>
      selectedAreaId === SelectorSpecialValue.None
        ? entry.area_id === null
        : entry.area_id === selectedAreaId,
    );
    if (filtered.length === 0) {
      return processedEntries.filter((entry) => entry.isPlaceholder);
    }
    return filtered;
  }, [
    processedAdvancedSearchData,
    processedEntries,
    queryMode,
    selectedAreaId,
  ]);

  return {
    switchToAdvancedMode,
    switchToSingleMode,
    resetAdvancedSearch,
    loadAdvancedSearchResults,
    handleAdvancedSearch,
    filteredEntries,
  };
}
