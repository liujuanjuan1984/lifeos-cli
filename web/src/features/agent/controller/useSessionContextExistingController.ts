import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import { cardboxApi, cardboxKeys } from "@/services/api/cardbox";
import {
  invalidateCardboxContextList,
  invalidateCardboxSessionState,
} from "@/services/api/cacheInvalidation/cardbox";
import type {
  ContextBoxItem,
  ContextBoxSummary,
  SessionContextBox,
  SessionContextSelectionResponse,
} from "@/types/cardbox";
import { canonicalModule } from "@/components/agent/contextPicker/moduleUtils";

interface UseSessionContextExistingControllerParams {
  isOpen: boolean;
  isExistingTabActive: boolean;
  sessionId?: string | null;
  existingBoxes: SessionContextBox[];
  onAddBoxes: (
    boxIds: string[],
  ) => Promise<SessionContextSelectionResponse | undefined>;
  notifySuccess: (message: string) => void;
}

export function useSessionContextExistingController({
  isOpen,
  isExistingTabActive,
  sessionId,
  existingBoxes,
  onAddBoxes,
  notifySuccess,
}: UseSessionContextExistingControllerParams) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [previewBox, setPreviewBox] = useState<ContextBoxSummary | null>(null);
  const [existingPreviewItems, setExistingPreviewItems] = useState<
    ContextBoxItem[]
  >([]);
  const [existingPreviewLoading, setExistingPreviewLoading] = useState(false);
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContextBoxSummary | null>(
    null,
  );

  const { data: boxesData, isLoading: listLoading } = useQuery({
    queryKey: cardboxKeys.contextList(),
    queryFn: cardboxApi.listContextBoxes,
    enabled: isOpen && isExistingTabActive,
    staleTime: 60_000,
  });
  const boxes = useMemo(() => boxesData ?? [], [boxesData]);

  const existingIds = useMemo(() => {
    return new Set(existingBoxes.map((item) => item.box.box_id));
  }, [existingBoxes]);

  const mergedBoxes = useMemo(() => {
    const map = new Map<string, ContextBoxSummary>();
    existingBoxes.forEach((item) => {
      map.set(item.box.box_id, {
        ...item.box,
        module: String(canonicalModule(item.box.module ?? "")),
      });
    });
    boxes.forEach((summary) => {
      map.set(summary.box_id, {
        ...summary,
        module: String(canonicalModule(summary.module ?? "")),
      });
    });
    return Array.from(map.values());
  }, [boxes, existingBoxes]);

  const filteredBoxes = useMemo(() => {
    if (!search.trim()) return mergedBoxes;
    const keyword = search.trim().toLowerCase();
    return mergedBoxes.filter(
      (box) =>
        box.display_name.toLowerCase().includes(keyword) ||
        box.module.toLowerCase().includes(keyword),
    );
  }, [mergedBoxes, search]);

  const deleteBoxMutation = useMutation<void, Error, string>({
    mutationFn: (boxId) => cardboxApi.deleteContextBox(boxId),
    onSuccess: () => {
      invalidateCardboxContextList(queryClient);
      if (sessionId) {
        invalidateCardboxSessionState(queryClient, sessionId);
      }
    },
  });

  const handleExistingPreview = useCallback(
    async (summary: ContextBoxSummary) => {
      setExistingPreviewLoading(true);
      try {
        const response = await cardboxApi.previewContextBox(summary.box_id);
        const boxData = response.box ?? summary;
        setPreviewBox({
          ...boxData,
          module: String(canonicalModule(boxData.module ?? "")),
        });
        setExistingPreviewItems(response.items ?? []);
      } catch (error) {
        console.error("Failed to preview context box", error);
        toast.showError(t("common.error"), t("agent.context.previewError"));
      } finally {
        setExistingPreviewLoading(false);
      }
    },
    [t, toast],
  );

  const handleAddExisting = useCallback(
    async (summary: ContextBoxSummary) => {
      if (!sessionId) return;
      setPendingAddId(summary.box_id);
      try {
        await onAddBoxes([summary.box_id]);
        const name = summary.display_name || summary.name || "";
        notifySuccess(
          t("agent.context.addSuccess", {
            name,
          }),
        );
      } catch (error) {
        console.error("Failed to add context box", error);
        toast.showError(t("common.error"), t("agent.context.addError"));
      } finally {
        setPendingAddId(null);
      }
    },
    [notifySuccess, onAddBoxes, sessionId, t, toast],
  );

  const handleDeleteBox = useCallback(
    (summary: ContextBoxSummary) => {
      if (deleteBoxMutation.isPending) return;
      setPendingDelete(summary);
    },
    [deleteBoxMutation.isPending],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteBoxMutation.mutateAsync(pendingDelete.box_id);
      if (previewBox && previewBox.box_id === pendingDelete.box_id) {
        setPreviewBox(null);
        setExistingPreviewItems([]);
      }
      const name = pendingDelete.display_name || pendingDelete.name || "";
      notifySuccess(
        t("agent.context.deleteSuccess", {
          name,
        }),
      );
    } catch (error) {
      console.error("Failed to delete context box", error);
      toast.showError(t("common.error"), t("agent.context.deleteError"));
    } finally {
      setPendingDelete(null);
    }
  }, [deleteBoxMutation, notifySuccess, pendingDelete, previewBox, t, toast]);

  const handleCancelDelete = useCallback(() => {
    if (deleteBoxMutation.isPending) return;
    setPendingDelete(null);
  }, [deleteBoxMutation.isPending]);

  const resetExistingState = useCallback(() => {
    setSearch("");
    setPreviewBox(null);
    setExistingPreviewItems([]);
    setExistingPreviewLoading(false);
    setPendingAddId(null);
    setPendingDelete(null);
  }, []);

  const deleteState = {
    isPending: deleteBoxMutation.isPending,
    targetId:
      deleteBoxMutation.isPending &&
      typeof deleteBoxMutation.variables === "string"
        ? deleteBoxMutation.variables
        : null,
  };

  return {
    search,
    setSearch,
    previewBox,
    existingPreviewItems,
    existingPreviewLoading,
    pendingAddId,
    pendingDelete,
    listLoading,
    filteredBoxes,
    existingIds,
    deleteState,
    handleExistingPreview,
    handleAddExisting,
    handleDeleteBox,
    handleConfirmDelete,
    handleCancelDelete,
    resetExistingState,
  };
}
