import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import { cardboxApi } from "@/services/api/cardbox";
import { invalidateCardboxContextList } from "@/services/api/cacheInvalidation/cardbox";
import type { ActualEvent } from "@/services/api/actualEvents";
import type { Note } from "@/services/api/notes";
import type { Task } from "@/services/api/tasks";
import type { Tag } from "@/services/api/tags";
import type { UUID } from "@/types/primitive";
import type { VisionWithTasks } from "@/services/api/visions";
import type { SessionContextSelectionResponse } from "@/types/cardbox";
import { useDimensions } from "@/hooks/queries/useDimensions";
import { useTagSelectorSource } from "@/hooks/selectors/useTagSelectorSource";
import {
  buildModuleFilters,
  canonicalModule,
  fetchModulePreview,
  type PlanningCycleType,
  type TaskStatusOption,
} from "@/components/agent/contextPicker/moduleUtils";
import {
  CONTEXT_MODULE_CONFIG,
  MODULE_OPTIONS,
  type ContextModuleConfig,
  type ModuleFormSections,
  type ModuleValidationConfig,
  type ModuleValue,
} from "@/components/agent/contextPicker/moduleConfig";

type PreviewState = {
  module: ModuleValue;
  items: ActualEvent[] | Note[] | Task[] | VisionWithTasks[];
  filters: Record<string, unknown>;
};

interface UseSessionContextCreateControllerParams {
  sessionId?: string | null;
  onAddBoxes: (
    boxIds: string[],
  ) => Promise<SessionContextSelectionResponse | undefined>;
  notifySuccess: (message: string) => void;
}

const formatLocalDate = (input: Date): string => {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getYesterdayLocalDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatLocalDate(date);
};

export function useSessionContextCreateController({
  sessionId,
  onAddBoxes,
  notifySuccess,
}: UseSessionContextCreateControllerParams) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const toast = useToast();

  const [createModule, setCreateModule] = useState<ModuleValue>(
    MODULE_OPTIONS[0].value,
  );
  const [createName, setCreateName] = useState("");
  const [createKeyword, setCreateKeyword] = useState("");
  const [createStartDate, setCreateStartDate] = useState<string>(
    getYesterdayLocalDate,
  );
  const [createEndDate, setCreateEndDate] = useState<string>(
    getYesterdayLocalDate,
  );
  const [createDimensionId, setCreateDimensionId] = useState<
    string | null | undefined
  >(undefined);
  const [createNoteTagIds, setCreateNoteTagIds] = useState<UUID[]>([]);
  const [createNotePersonIds, setCreateNotePersonIds] = useState<UUID[]>([]);
  const [planningCycleType, setPlanningCycleType] =
    useState<PlanningCycleType>("day");
  const [planningStartDate, setPlanningStartDate] = useState<string>(
    getYesterdayLocalDate,
  );
  const [planningStatusOption, setPlanningStatusOption] =
    useState<TaskStatusOption>("all");
  const [selectedVisionIds, setSelectedVisionIds] = useState<UUID[]>([]);
  const [visionStatusOption, setVisionStatusOption] =
    useState<TaskStatusOption>("all");
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);

  const activeModuleConfig = CONTEXT_MODULE_CONFIG[
    createModule
  ] as ContextModuleConfig;
  const moduleFormSections = (activeModuleConfig.formSections ??
    {}) as ModuleFormSections;
  const moduleValidation = (
    "validation" in activeModuleConfig && activeModuleConfig.validation
      ? activeModuleConfig.validation
      : {}
  ) as ModuleValidationConfig;

  const { dimensions } = useDimensions();
  const dimensionMap = useMemo(() => {
    const map = new Map<string, string>();
    (dimensions ?? []).forEach((dimension) => {
      map.set(String(dimension.id), dimension.name);
    });
    return map;
  }, [dimensions]);

  const {
    tags: noteTags,
    refresh: refreshNoteTags,
    createTag: createNoteTag,
  } = useTagSelectorSource({ entityType: "note" });

  useEffect(() => {
    setPreviewState(null);
    setPreviewError(null);
    setCreateFeedback(null);
  }, [createModule]);

  useEffect(() => {
    if (!createFeedback) return;
    const timer = window.setTimeout(() => setCreateFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [createFeedback]);

  const createBoxMutation = useMutation({
    mutationFn: cardboxApi.createContextBox,
    onSuccess: () => {
      invalidateCardboxContextList(queryClient);
    },
  });

  const resetCreateForm = useCallback((resetModule = false) => {
    if (resetModule && MODULE_OPTIONS.length > 0) {
      setCreateModule(MODULE_OPTIONS[0].value);
    }
    setCreateName("");
    setCreateKeyword("");
    const yesterday = getYesterdayLocalDate();
    setCreateStartDate(yesterday);
    setCreateEndDate(yesterday);
    setCreateDimensionId(null);
    setCreateNoteTagIds([]);
    setCreateNotePersonIds([]);
    setPlanningCycleType("day");
    setPlanningStartDate(yesterday);
    setPlanningStatusOption("all");
    setSelectedVisionIds([]);
    setVisionStatusOption("all");
    setPreviewState(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setCreateFeedback(null);
  }, []);

  const previewCreateData = useCallback(async () => {
    setPreviewError(null);
    setCreateFeedback(null);
    if (moduleValidation.requireStartDate && !planningStartDate) {
      setPreviewError(t("agent.context.errors.selectPlanningStartDate"));
      return;
    }
    if (
      moduleValidation.requireVisionSelection &&
      selectedVisionIds.length === 0
    ) {
      setPreviewError(t("agent.context.errors.selectAtLeastOneVision"));
      return;
    }

    const filters = buildModuleFilters({
      module: createModule,
      createStartDate,
      createEndDate,
      createKeyword,
      createDimensionId,
      dimensionMap,
      createNoteTagIds,
      createNotePersonIds,
      planningCycleType,
      planningStartDate,
      planningStatusOption,
      selectedVisionIds,
      visionStatusOption,
    });

    setPreviewState(null);
    setPreviewLoading(true);
    try {
      const items = await fetchModulePreview({
        module: createModule,
        filters,
        queryClient,
        t,
      });
      setPreviewState({
        module: canonicalModule(createModule) as ModuleValue,
        items,
        filters,
      });
      setCreateFeedback(
        t("agent.context.previewFoundRecords", { count: items.length }),
      );
    } catch (error) {
      console.error("Failed to preview module data", error);
      const message =
        error instanceof Error
          ? error.message
          : t("agent.context.errors.previewFailed");
      setPreviewError(message);
      toast.showError(t("common.error"), message);
    } finally {
      setPreviewLoading(false);
    }
  }, [
    createDimensionId,
    createEndDate,
    createKeyword,
    createModule,
    createNotePersonIds,
    createNoteTagIds,
    createStartDate,
    dimensionMap,
    moduleValidation.requireStartDate,
    moduleValidation.requireVisionSelection,
    planningCycleType,
    planningStartDate,
    planningStatusOption,
    queryClient,
    selectedVisionIds,
    t,
    toast,
    visionStatusOption,
  ]);

  const createAndAdd = useCallback(async () => {
    if (!sessionId) return false;
    if (!previewState || previewState.items.length === 0) {
      toast.showError(t("common.error"), t("agent.context.previewRequired"));
      return false;
    }

    try {
      const response = await createBoxMutation.mutateAsync({
        module: previewState.module,
        name: createName.trim() || undefined,
        filters: previewState.filters,
        overwrite: true,
      });
      await onAddBoxes([response.box.box_id]);
      const successMessage = t("agent.context.createSuccess", {
        name: response.box.display_name,
      });
      setCreateFeedback(successMessage);
      notifySuccess(successMessage);
      return true;
    } catch (error) {
      console.error("Failed to create context box", error);
      const message =
        error instanceof Error ? error.message : t("agent.context.createError");
      toast.showError(t("common.error"), message);
      return false;
    }
  }, [
    createBoxMutation,
    createName,
    notifySuccess,
    onAddBoxes,
    previewState,
    sessionId,
    t,
    toast,
  ]);

  const handleCreateNoteTag = useCallback(
    async (name: string): Promise<Tag> => {
      const newTag = await createNoteTag(name);
      await refreshNoteTags();
      return newTag;
    },
    [createNoteTag, refreshNoteTags],
  );

  const handleNoteTagChange = useCallback((ids: UUID[]) => {
    if (ids.length === 0) {
      setCreateNoteTagIds([]);
      return;
    }
    const last = ids[ids.length - 1];
    setCreateNoteTagIds(last ? [last] : []);
  }, []);

  const handleNotePersonChange = useCallback((ids: UUID[]) => {
    if (ids.length === 0) {
      setCreateNotePersonIds([]);
      return;
    }
    const first = ids[0];
    setCreateNotePersonIds(first ? [first] : []);
  }, []);

  const createButtonDisabled =
    createBoxMutation.isPending || previewLoading || !previewState;

  return {
    createModule,
    setCreateModule,
    createName,
    setCreateName,
    createKeyword,
    setCreateKeyword,
    createStartDate,
    setCreateStartDate,
    createEndDate,
    setCreateEndDate,
    createDimensionId,
    setCreateDimensionId,
    createNoteTagIds,
    createNotePersonIds,
    planningCycleType,
    setPlanningCycleType,
    planningStartDate,
    setPlanningStartDate,
    planningStatusOption,
    setPlanningStatusOption,
    selectedVisionIds,
    setSelectedVisionIds,
    visionStatusOption,
    setVisionStatusOption,
    activeModuleConfig,
    moduleFormSections,
    moduleValidation,
    previewState,
    previewLoading,
    previewError,
    createFeedback,
    createButtonDisabled,
    isCreating: createBoxMutation.isPending,
    dimensionMap,
    noteTags,
    handleCreateNoteTag,
    handleNoteTagChange,
    handleNotePersonChange,
    resetCreateForm,
    previewCreateData,
    createAndAdd,
  };
}
