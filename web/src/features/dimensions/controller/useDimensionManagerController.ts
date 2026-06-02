import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/ToastContext";
import { logger } from "@/utils/core";
import { dimensionsApi, type Dimension } from "@/services/api/dimensions";
import { useModalState } from "@/hooks/useModalState";
import {
  invalidateDimensionDetail,
  invalidateDimensionOrder,
  invalidateDimensionsLists,
  removeDimensionDetailCache,
  setDimensionDetailCache,
} from "@/services/api/cacheInvalidation/dimensions";

interface DimensionFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

interface UseDimensionManagerControllerParams {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_FORM_DATA: DimensionFormData = {
  name: "",
  description: "",
  color: "#3B82F6",
  icon: "",
  is_active: true,
  display_order: 0,
};

export function useDimensionManagerController({
  isOpen,
  onClose,
}: UseDimensionManagerControllerParams) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { loading, withLoading } = useModalState();

  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(
    null,
  );
  const [deletingDimension, setDeletingDimension] = useState<Dimension | null>(
    null,
  );
  const [formData, setFormData] =
    useState<DimensionFormData>(DEFAULT_FORM_DATA);

  const fetchDimensions = useCallback(async () => {
    try {
      await withLoading(async () => {
        const response = await dimensionsApi.getDimensions();
        setDimensions(
          (response.items ?? []).sort(
            (a, b) => (a.display_order || 0) - (b.display_order || 0),
          ),
        );
      });
    } catch (error) {
      logger.error("Failed to fetch dimensions:", error);
    }
  }, [withLoading]);

  useEffect(() => {
    if (isOpen) {
      void fetchDimensions();
    }
  }, [fetchDimensions, isOpen]);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setEditingDimension(null);
    setShowForm(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleEdit = useCallback((dimension: Dimension) => {
    setEditingDimension(dimension);
    setFormData({
      name: dimension.name,
      description: dimension.description || "",
      color: dimension.color || "#3B82F6",
      icon: dimension.icon || "",
      is_active: dimension.is_active,
      display_order: dimension.display_order || 0,
    });
    setShowForm(true);
  }, []);

  const requestDelete = useCallback((dimension: Dimension) => {
    setDeletingDimension(dimension);
  }, []);

  const saveDimension = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      try {
        await withLoading(async () => {
          let persisted: Dimension | null = null;

          if (editingDimension) {
            const updated = await dimensionsApi.updateDimension(
              editingDimension.id,
              formData,
            );
            setDimensions((prev) =>
              prev.map((dimension) =>
                dimension.id === updated.id ? updated : dimension,
              ),
            );
            persisted = updated;
          } else {
            const created = await dimensionsApi.createDimension({
              ...formData,
              display_order: dimensions.length,
            });
            setDimensions((prev) => [...prev, created]);
            persisted = created;
          }

          if (persisted) {
            setDimensionDetailCache(queryClient, persisted);
            await Promise.all([
              invalidateDimensionsLists(queryClient),
              invalidateDimensionDetail(queryClient, persisted.id),
              invalidateDimensionOrder(queryClient),
            ]);
          }

          resetForm();
          toast.showSuccess(
            editingDimension
              ? t("dimensionManager.dimensionUpdated")
              : t("dimensionManager.dimensionCreated"),
            editingDimension
              ? t("dimensionManager.dimensionUpdateSuccess")
              : t("dimensionManager.dimensionCreateSuccess"),
          );
        });
      } catch (error) {
        logger.error("Failed to save dimension:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : t("dimensionManager.retryLater");
        toast.showError(
          t("dimensionManager.saveError"),
          `${t("dimensionManager.operationFailed")}${errorMessage}`,
        );
      }
    },
    [
      dimensions.length,
      editingDimension,
      formData,
      queryClient,
      resetForm,
      t,
      toast,
      withLoading,
    ],
  );

  const confirmDelete = useCallback(async () => {
    if (!deletingDimension) return;

    try {
      await withLoading(async () => {
        await dimensionsApi.deleteDimension(deletingDimension.id);
        setDimensions((prev) =>
          prev.filter((dimension) => dimension.id !== deletingDimension.id),
        );
        removeDimensionDetailCache(queryClient, deletingDimension.id);
        toast.showSuccess(
          t("dimensionManager.dimensionDeleted"),
          `"${deletingDimension.name}"${t("dimensionManager.dimensionDeleteSuccess")}`,
        );
        await Promise.all([
          invalidateDimensionsLists(queryClient),
          invalidateDimensionOrder(queryClient),
        ]);
      });
    } catch (error) {
      logger.error("Failed to delete dimension:", error);
      toast.showError(
        t("dimensionManager.deleteError"),
        t("dimensionManager.retryLater"),
      );
    } finally {
      setDeletingDimension(null);
    }
  }, [deletingDimension, queryClient, t, toast, withLoading]);

  const toggleActive = useCallback(
    async (dimension: Dimension) => {
      try {
        await withLoading(async () => {
          const updated = await dimensionsApi.updateDimension(dimension.id, {
            is_active: !dimension.is_active,
          });
          setDimensions((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item)),
          );
          setDimensionDetailCache(queryClient, updated);
          await Promise.all([
            invalidateDimensionsLists(queryClient),
            invalidateDimensionDetail(queryClient, updated.id),
          ]);
        });
      } catch (error) {
        logger.error("Failed to toggle dimension:", error);
      }
    },
    [queryClient, withLoading],
  );

  return {
    loading,
    dimensions,
    showForm,
    setShowForm,
    editingDimension,
    deletingDimension,
    formData,
    setFormData,
    resetForm,
    handleClose,
    handleEdit,
    requestDelete,
    saveDimension,
    confirmDelete,
    toggleActive,
    clearDeletingDimension: () => setDeletingDimension(null),
  };
}
