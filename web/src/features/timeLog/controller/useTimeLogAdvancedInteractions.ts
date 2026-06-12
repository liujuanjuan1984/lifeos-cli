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
  dimsFromCache: TimeLogPageData["dimsFromCache"];
  sortOrder: "asc" | "desc";
  setAdvancedSearchResultsFromHook: (results: ProcessedEntry[]) => void;
  showError: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
  t: TFunction;
  processedEntries: ProcessedEntry[];
  selectedDimensionId:
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
  processedAdvancedSearchData: ProcessedEntry[];
  filteredEntries: ProcessedEntry[];
}

export function useTimeLogAdvancedInteractions({
  queryMode,
  setQueryMode,
  advancedSearchParams,
  setAdvancedSearchParams,
  advancedSearch,
  dimsFromCache,
  sortOrder,
  setAdvancedSearchResultsFromHook,
  showError,
  showInfo,
  t,
  processedEntries,
  selectedDimensionId,
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
      dimension_id: undefined,
      dimension_name: null,
      description_keyword: null,
      task_id: undefined,
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
    const dimensionName =
      typeof advancedSearchParams.dimension_id === "string"
        ? dimsFromCache?.find((d) => d.id === advancedSearchParams.dimension_id)
            ?.name || null
        : null;

    const { task_id, ...restParams } = advancedSearchParams;
    const normalizedTaskId =
      typeof task_id === "string" && task_id === SelectorSpecialValue.All
        ? undefined
        : task_id;

    return {
      ...restParams,
      ...(advancedSearchParams.dimension_id !== undefined && {
        dimension_id: advancedSearchParams.dimension_id,
      }),
      ...(normalizedTaskId !== undefined && { task_id: normalizedTaskId }),
      dimension_name: dimensionName,
      sort_order: sortOrder,
    };
  }, [advancedSearchParams, dimsFromCache, sortOrder]);

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
      selectedDimensionId === null ||
      selectedDimensionId === undefined ||
      selectedDimensionId === ""
    )
      return processedEntries;

    const filtered = processedEntries.filter((entry) =>
      selectedDimensionId === SelectorSpecialValue.None
        ? entry.dimension_id === null
        : entry.dimension_id === selectedDimensionId,
    );
    if (filtered.length === 0) {
      return processedEntries.filter((entry) => entry.isPlaceholder);
    }
    return filtered;
  }, [
    processedAdvancedSearchData,
    processedEntries,
    queryMode,
    selectedDimensionId,
  ]);

  return {
    switchToAdvancedMode,
    switchToSingleMode,
    resetAdvancedSearch,
    loadAdvancedSearchResults,
    handleAdvancedSearch,
    processedAdvancedSearchData,
    filteredEntries,
  };
}
