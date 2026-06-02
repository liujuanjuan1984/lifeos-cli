import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TFunction } from "i18next";
import type { QueryMode } from "@/hooks/useQueryMode";
import type {
  useAdvancedSearchWithPagination,
  AdvancedSearchParams,
} from "@/hooks/queries/useAdvancedSearch";
import type { ProcessedEntry } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";
import type {
  ExtendedTimelogExportParams,
  ExportResult,
} from "@/hooks/useExport";
import type { TimeLogPageData } from "./useTimeLogPageData";
import { SelectorSpecialValue } from "@/components/selects/selectorTypes";
import { createDateBoundaries } from "@/utils/datetime";
import { logger } from "@/utils/core";
import type { ActualEventAdvancedSearchMetadata } from "@/services/api/actualEvents";

interface TimeLogAdvancedInteractionsOptions {
  queryMode: QueryMode;
  setQueryMode: (mode: QueryMode) => void;
  advancedSearchParams: TimeLogPageData["advancedSearchParams"];
  setAdvancedSearchParams: TimeLogPageData["setAdvancedSearchParams"];
  advancedSearch: ReturnType<typeof useAdvancedSearchWithPagination>;
  dimsFromCache: TimeLogPageData["dimsFromCache"];
  sortOrder: "asc" | "desc";
  setAdvancedSearchResultsFromHook: (results: ProcessedEntry[]) => void;
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
  showWarning: (title: string, description?: string) => void;
  t: TFunction;
  exportData: (
    params: ExtendedTimelogExportParams,
    options?: {
      showToasts?: boolean;
      onSuccess?: (result: ExportResult) => void;
      onError?: (error: Error) => void;
    },
  ) => Promise<void>;
  processedEntries: ProcessedEntry[];
  selectedDimensionId:
    | UUID
    | null
    | string
    | undefined
    | typeof SelectorSpecialValue.None;
  activeTimezone: string;
  selectedDate: Date;
}

interface TimeLogAdvancedInteractionsReturn {
  switchToAdvancedMode: () => void;
  switchToSingleMode: () => void;
  resetAdvancedSearch: () => void;
  loadAdvancedSearchResults: () => Promise<void>;
  handleExportAdvanced: () => Promise<void>;
  handleExportDaily: () => Promise<void>;
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
  showSuccess,
  showError,
  showInfo,
  showWarning,
  t,
  exportData,
  processedEntries,
  selectedDimensionId,
  activeTimezone,
  selectedDate,
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

  const notifyExportTruncation = useCallback(
    (metadata?: ActualEventAdvancedSearchMetadata | null) => {
      if (!metadata?.truncated) {
        return;
      }

      showWarning(
        t("timeLog.messages.exportTruncatedTitle", {
          limit: metadata.limit,
        }),
        t("timeLog.messages.exportTruncatedDescription", {
          limit: metadata.limit,
          total: metadata.total_count,
        }),
      );
    },
    [showWarning, t],
  );

  const handleExportAdvanced = useCallback(async () => {
    if (queryMode !== "advanced" || !advancedSearch.data.length) {
      return;
    }

    try {
      const exportParams: ExtendedTimelogExportParams = {
        start_date: new Date(advancedSearchParams.start_date),
        end_date: new Date(advancedSearchParams.end_date),
        ...(advancedSearchParams.dimension_id !== undefined && {
          dimension_id: advancedSearchParams.dimension_id,
        }),
        description_keyword: advancedSearchParams.description_keyword,
      };

      await exportData(exportParams, {
        // We handle toast manually to keep behaviour consistent with daily export
        // and to make the success signal testable when the export hook is mocked.
        showToasts: false,
        onSuccess: (result) => {
          showSuccess(
            t("timeLog.advancedSearch.export"),
            t("timeLog.messages.exportCompleted"),
          );
          notifyExportTruncation(result.metadata);
        },
        onError: (error) => {
          showError(
            t("timeLog.messages.exportFailed"),
            error.message || t("timeLog.messages.exportError"),
          );
        },
      });
    } catch (err) {
      showError(
        t("timeLog.messages.exportFailed"),
        err instanceof Error ? err.message : t("timeLog.messages.exportError"),
      );
    }
  }, [
    advancedSearch.data.length,
    advancedSearchParams,
    exportData,
    queryMode,
    showError,
    showSuccess,
    notifyExportTruncation,
    t,
  ]);

  const handleExportDaily = useCallback(async () => {
    const entriesForExport = filteredEntries.filter(
      (entry) => !entry.isPlaceholder,
    );

    if (!entriesForExport.length) {
      showInfo(
        t("timeLog.toolbar.exportDaily"),
        t("timeLog.messages.noDataToExport"),
      );
      return;
    }

    try {
      showInfo(
        t("timeLog.toolbar.exportDaily"),
        t("timeLog.messages.exporting"),
      );

      const { startOfDay, endOfDay } = createDateBoundaries(
        selectedDate,
        activeTimezone,
      );

      const exportParams: ExtendedTimelogExportParams = {
        start_date: startOfDay,
        end_date: endOfDay,
        ...(selectedDimensionId !== undefined &&
          selectedDimensionId !== "" && {
            dimension_id:
              selectedDimensionId === SelectorSpecialValue.None
                ? null
                : selectedDimensionId,
          }),
        description_keyword: null,
      };

      await exportData(exportParams, {
        showToasts: false,
        onSuccess: (result) => {
          showSuccess(
            t("timeLog.toolbar.exportDaily"),
            t("timeLog.messages.exportCompleted"),
          );
          notifyExportTruncation(result.metadata);
        },
        onError: (error) => {
          showError(
            t("timeLog.messages.exportFailed"),
            error.message || t("timeLog.messages.exportError"),
          );
        },
      });
    } catch (err) {
      showError(
        t("timeLog.messages.exportFailed"),
        err instanceof Error ? err.message : t("timeLog.messages.exportError"),
      );
    }
  }, [
    activeTimezone,
    exportData,
    filteredEntries,
    selectedDimensionId,
    notifyExportTruncation,
    showError,
    showInfo,
    showSuccess,
    t,
    selectedDate,
  ]);

  return {
    switchToAdvancedMode,
    switchToSingleMode,
    resetAdvancedSearch,
    loadAdvancedSearchResults,
    handleExportAdvanced,
    handleExportDaily,
    handleAdvancedSearch,
    processedAdvancedSearchData,
    filteredEntries,
  };
}
