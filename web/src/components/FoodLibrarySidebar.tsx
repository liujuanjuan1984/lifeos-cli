import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { type FoodSummary } from "@/services/api";
import { logger } from "@/utils/core";
import ActionButton from "./ActionButton";
import ListContainer from "@/layouts/ListContainer";
// Removed nested collapsible to avoid double expansion under outer ExpandableCard
import { type Food } from "@/services/api";
import { useFoods } from "@/hooks/queries/useFoods";
import { TextInput, Checkbox } from "./forms";
import type { UUID } from "@/types/primitive";
import { Icon } from "./icons";

interface FoodLibrarySidebarProps {
  onFoodSelected?: (food: FoodSummary) => void;
  onAddFood?: () => void;
  onEditFood?: (food: Food) => void;
  onDeleteFood?: (foodId: UUID) => void;
  className?: string;
  idPrefix?: string;
  /** Layout variant: standalone (default) or embedded inside a card */
  variant?: "standalone" | "embedded";
}

export default function FoodLibrarySidebar({
  onFoodSelected,
  onAddFood,
  onEditFood,
  onDeleteFood,
  className = "",
  idPrefix = "",
  variant = "standalone",
}: FoodLibrarySidebarProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCommonOnly, setShowCommonOnly] = useState(false);
  // Filters are always visible now to avoid nested collapsible
  const { foods, query } = useFoods({
    search: searchTerm,
    commonOnly: showCommonOnly,
    size: 100,
    staleTimeMs: 60 * 1000,
  });

  useEffect(() => {
    if (query.error) {
      logger.error("Failed to load foods", query.error);
    }
  }, [query.error]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleCommonFilter = (value: boolean) => {
    setShowCommonOnly(value);
  };

  const handleFoodClick = (food: FoodSummary) => {
    if (onFoodSelected) {
      onFoodSelected(food);
    }
  };

  const containerClasses = [
    "flex flex-col min-h-0",
    variant === "embedded" ? "" : "bg-base-100 border-b border-base-200",
    className,
  ]
    .join(" ")
    .trim();

  const filtersSectionClasses = [
    "space-y-3 border-b border-base-200/70",
    variant === "embedded"
      ? "px-4 sm:px-6 pt-2 pb-4"
      : "px-4 sm:px-6 pt-4 pb-4",
  ].join(" ");

  const listContainerClasses = [
    "h-full",
    variant === "embedded" ? "bg-transparent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className={filtersSectionClasses}>
        <TextInput
          id={`${idPrefix}food-search`}
          name={`${idPrefix}food-search`}
          type="text"
          placeholder={t("foodLibrarySidebar.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          size="md"
        />

        <Checkbox
          id={`${idPrefix}common-foods-filter`}
          name={`${idPrefix}common-foods-filter`}
          checked={showCommonOnly}
          onCheckedChange={handleCommonFilter}
          label={t("foodLibrarySidebar.showCommonOnly")}
          variant="primary"
          size="sm"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <ListContainer
          title={t("foodLibrarySidebar.title")}
          borderVariant={variant === "embedded" ? "none" : "default"}
          shadow={variant === "embedded" ? "none" : "md"}
          className={listContainerClasses}
          headerAction={
            <ActionButton
              label={t("common.add")}
              color="primary"
              variant="solid"
              size="sm"
              onClick={onAddFood}
            />
          }
          emptyState={
            foods.length === 0 ? (
              <div className="p-6 text-center">
                <Icon
                  name="sparkles"
                  size={32}
                  className="mb-3 text-primary"
                  aria-hidden
                />
                <h4 className="text-base font-medium text-base-content mb-1">
                  {t("foodLibrarySidebar.noFoodFound")}
                </h4>
                <p className="text-sm text-base-content/60 mb-3">
                  {searchTerm || showCommonOnly
                    ? t("foodLibrarySidebar.adjustSearchConditions")
                    : t("foodLibrarySidebar.clickToAddFood")}
                </p>
                {!searchTerm && !showCommonOnly && (
                  <ActionButton
                    label={t("foodLibrarySidebar.addFood")}
                    color="primary"
                    variant="solid"
                    size="sm"
                    onClick={onAddFood}
                  />
                )}
              </div>
            ) : null
          }
        >
          {foods.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              {foods.map((food) => (
                <div
                  key={food.id}
                  onClick={() => handleFoodClick(food)}
                  className="group rounded-lg border border-transparent bg-base-100/80 p-3 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-base-content truncate">
                        {food.name}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                        <span className="font-medium text-warning">
                          {Math.round(food.calories_per_100g || 0)}
                          {t("foodLibrarySidebar.caloriesPer100g")}
                        </span>
                        {food.is_common && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {t("foodLibrarySidebar.common")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ActionButton
                        label={t("common.edit")}
                        iconName="edit"
                        color="neutral"
                        size="xs"
                        variant="ghost"
                        iconOnly
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditFood?.(food as unknown as Food);
                        }}
                      />
                      <ActionButton
                        label={t("common.delete")}
                        iconName="trash"
                        color="error"
                        size="xs"
                        variant="ghost"
                        iconOnly
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFood?.(food.id);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ListContainer>
      </div>
    </div>
  );
}
