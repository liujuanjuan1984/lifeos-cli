import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { dimensionsApi, type Dimension } from "@/services/api/dimensions";
import { logger } from "@/utils/core";
import type { UUID } from "@/types/primitive";
import ActionButton from "./ActionButton";

interface DimensionSorterProps {
  dimensionOrder: UUID[];
  onOrderChange: (order: UUID[]) => void;
  loading?: boolean;
  disabled?: boolean;
  refreshTrigger?: number; // Add refresh trigger prop
  id?: string; // Add id prop for accessibility
  /** Whether to show a Clear All option */
  showClearAll?: boolean;
}

export default function DimensionSorter({
  dimensionOrder,
  onOrderChange,
  loading = false,
  disabled = false,
  refreshTrigger,
  id,
  showClearAll = true,
}: DimensionSorterProps) {
  const { t } = useTranslation();
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [dimensionsLoading, setDimensionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dimensions
  useEffect(() => {
    const loadDimensions = async () => {
      try {
        setDimensionsLoading(true);
        setError(null);
        const response = await dimensionsApi.getDimensions();
        setDimensions(response.items ?? []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load dimensions";
        setError(errorMessage);
        logger.error("Failed to load dimensions", err);
      } finally {
        setDimensionsLoading(false);
      }
    };

    loadDimensions();
  }, [refreshTrigger]); // Add refreshTrigger as dependency

  const { allDimensionIds, completeOrder } = useMemo(() => {
    const ids = dimensions.map((d) => d.id);
    const filteredOrder = dimensionOrder.filter((id) => ids.includes(id));
    const missing = ids.filter((id) => !filteredOrder.includes(id));

    return {
      allDimensionIds: ids,
      completeOrder: [...filteredOrder, ...missing],
    };
  }, [dimensions, dimensionOrder]);

  // Handle move up/down buttons based on the complete order we display
  const moveDimension = (dimensionId: UUID, direction: "up" | "down") => {
    const workingOrder = [...completeOrder];
    const currentIndex = workingOrder.indexOf(dimensionId);

    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= workingOrder.length) return;

    [workingOrder[currentIndex], workingOrder[newIndex]] = [
      workingOrder[newIndex],
      workingOrder[currentIndex],
    ];

    onOrderChange(workingOrder);
  };

  const allOrderedDimensions = completeOrder
    .map((id) => dimensions.find((d) => d.id === id))
    .filter((d): d is Dimension => d !== undefined);

  if (dimensionsLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-base-content/60">
          {t("settings.dimensionSorter.loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-error bg-error/20 rounded">
        {t("settings.dimensionSorter.error", { message: error })}
      </div>
    );
  }

  if (allOrderedDimensions.length === 0) {
    return (
      <div className="p-4 text-sm bg-base-200 rounded">
        {t("settings.dimensionSorter.empty")}
      </div>
    );
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={t("settings.dimensionSorter.groupLabel")}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-sm mb-2">
        <span>{t("settings.dimensionSorter.instructions")}</span>
        {showClearAll && (
          <ActionButton
            label={t("settings.dimensionSorter.clearAll")}
            size="xs"
            variant="ghost"
            onClick={() => onOrderChange([...allDimensionIds])}
            disabled={disabled || loading || completeOrder.length === 0}
            ariaLabel={t("settings.dimensionSorter.clearAllAria")}
            className="h-7"
          />
        )}
      </div>
      <div
        role="list"
        aria-label={t("settings.dimensionSorter.listLabel")}
        className="space-y-1"
      >
        {allOrderedDimensions.map((dimension, index) => {
          return (
            <div
              key={dimension.id}
              role="listitem"
              aria-label={t("settings.dimensionSorter.itemLabel", {
                name: dimension.name,
                position: index + 1,
              })}
              className={`flex items-center gap-2 p-2 border rounded transition-colors ${
                disabled || loading
                  ? "bg-base-200 cursor-not-allowed opacity-60"
                  : "bg-base-100 hover-card"
              }`}
            >
              {/* Order number */}
              <div className="w-6 h-6 bg-base-300 rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>

              {/* Dimension color indicator */}
              <div
                className="w-4 h-4 rounded-full border"
                style={{ backgroundColor: dimension.color || "#9CA3AF" }}
              />

              {/* Dimension name */}
              <div className="flex-1 text-sm font-medium">{dimension.name}</div>

              {/* Move buttons */}
              <div className="flex flex-row gap-1">
                <ActionButton
                  label={t("settings.dimensionSorter.moveUp", {
                    name: dimension.name,
                  })}
                  iconName="arrow-up"
                  size="xs"
                  variant="ghost"
                  shape="square"
                  className="h-6 w-6"
                  onClick={() => moveDimension(dimension.id, "up")}
                  disabled={disabled || loading || index === 0}
                  ariaLabel={t("settings.dimensionSorter.moveUp", {
                    name: dimension.name,
                  })}
                  iconOnly
                />
                <ActionButton
                  label={t("settings.dimensionSorter.moveDown", {
                    name: dimension.name,
                  })}
                  iconName="arrow-down"
                  size="xs"
                  variant="ghost"
                  shape="square"
                  className="h-6 w-6"
                  onClick={() => moveDimension(dimension.id, "down")}
                  disabled={
                    disabled ||
                    loading ||
                    index === allOrderedDimensions.length - 1
                  }
                  ariaLabel={t("settings.dimensionSorter.moveDown", {
                    name: dimension.name,
                  })}
                  iconOnly
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
