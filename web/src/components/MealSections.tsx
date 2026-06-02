import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type FoodEntrySummary } from "@/services/api";
import ActionButton from "./ActionButton";
import ConfirmDialog from "./ConfirmDialog";
import InlineQuickFoodEntry from "./InlineQuickFoodEntry";
import ListContainer from "@/layouts/ListContainer";
import type { UUID } from "@/types/primitive";
import { Icon, type IconName } from "./icons";
import { formatTime } from "@/utils/datetime";

interface MealSectionsProps {
  entries: FoodEntrySummary[];
  onDelete: (entryId: UUID) => void;
  onEntryCreated: (entry: FoodEntrySummary) => void;
  selectedDate: string;
}

// This will be replaced with i18n keys

export default function MealSections({
  entries,
  onDelete,
  onEntryCreated,
  selectedDate,
}: MealSectionsProps) {
  const { t } = useTranslation();
  const [deletingEntry, setDeletingEntry] = useState<FoodEntrySummary | null>(
    null,
  );
  // Removed expandedMeals state as we now use a table layout
  const [showQuickAdd, setShowQuickAdd] = useState<Record<string, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
  });

  // Use entries directly instead of grouping
  const foodEntries = entries;

  // Sort meal types by display order
  const mealTypeConfig: Record<
    string,
    { label: string; iconName: IconName; color: string; order: number }
  > = {
    breakfast: {
      label: t("mealSections.mealTypes.breakfast"),
      iconName: "sun",
      color: "bg-warning/20 text-warning border-warning/30",
      order: 1,
    },
    lunch: {
      label: t("mealSections.mealTypes.lunch"),
      iconName: "fire",
      color: "bg-accent/20 text-accent border-accent/30",
      order: 2,
    },
    dinner: {
      label: t("mealSections.mealTypes.dinner"),
      iconName: "moon",
      color: "bg-secondary/20 text-secondary border-secondary/30",
      order: 3,
    },
    snack: {
      label: t("mealSections.mealTypes.snack"),
      iconName: "bolt",
      color: "bg-success/20 text-success border-success/30",
      order: 4,
    },
  };

  const sortedMealTypes = Object.keys(mealTypeConfig).sort(
    (a, b) =>
      mealTypeConfig[a as keyof typeof mealTypeConfig].order -
      mealTypeConfig[b as keyof typeof mealTypeConfig].order,
  );

  const handleDelete = (entry: FoodEntrySummary) => {
    setDeletingEntry(entry);
  };

  const confirmDelete = () => {
    if (deletingEntry) {
      onDelete(deletingEntry.id);
      setDeletingEntry(null);
    }
  };

  // Removed toggleMealExpansion as we now use a table layout

  const handleQuickAdd = (mealType: string) => {
    setShowQuickAdd((prev) => {
      // 如果当前餐次已经打开，则关闭它
      if (prev[mealType]) {
        return {
          breakfast: false,
          lunch: false,
          dinner: false,
          snack: false,
        };
      }
      // 否则关闭所有其他餐次，只打开当前餐次
      return {
        breakfast: false,
        lunch: false,
        dinner: false,
        snack: false,
        [mealType]: true,
      };
    });
  };

  const handleQuickAddCancel = (mealType: string) => {
    setShowQuickAdd((prev) => ({
      ...prev,
      [mealType]: false,
    }));
  };

  const handleQuickAddSuccess = (entry: FoodEntrySummary) => {
    // 关闭所有快捷添加输入框
    setShowQuickAdd({
      breakfast: false,
      lunch: false,
      dinner: false,
      snack: false,
    });
    onEntryCreated(entry); // Pass the created entry to parent
  };

  const handleQuickAddError = (error: string) => {
    console.error("Quick add error:", error);
    // Error handling is done in the InlineQuickFoodEntry component
  };

  // 处理餐次变更
  const handleMealTypeChange = (newMealType: string) => {
    // 关闭当前餐次，打开新餐次
    setShowQuickAdd({
      breakfast: false,
      lunch: false,
      dinner: false,
      snack: false,
      [newMealType]: true,
    });
  };

  // Removed renderQuickAddInput function as it's now inline in the table layout

  // 获取所有餐次的快速添加状态
  const hasAnyQuickAdd = Object.values(showQuickAdd).some(Boolean);

  return (
    <>
      <ListContainer
        title={t("mealSections.title")}
        columns={[
          {
            key: "meal",
            label: t("mealSections.tableHeaders.mealType"),
            width: "140px",
          },
          {
            key: "food",
            label: t("mealSections.tableHeaders.foodName"),
            width: "1fr",
          },
          {
            key: "portion",
            label: t("mealSections.tableHeaders.portion"),
            width: "120px",
            align: "right",
          },
          {
            key: "time",
            label: t("mealSections.tableHeaders.time"),
            width: "100px",
            align: "center",
          },
          {
            key: "actions",
            label: t("common.actions"),
            width: "140px",
            align: "right",
          },
        ]}
        headerAction={
          <ActionButton
            label={t("common.add")}
            color="primary"
            variant="solid"
            onClick={() => handleQuickAdd("breakfast")}
          />
        }
        emptyState={
          <div className="py-8 text-center text-base-content/60">
            <div className="text-base font-medium mb-2">
              {t("mealSections.noEntries")}
            </div>
            <div className="text-base">{t("mealSections.addEntryHint")}</div>
          </div>
        }
      >
        <div className="px-6 py-4">
          {foodEntries.length > 0 && (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "140px 1fr 120px 100px 140px" }}
            >
              {foodEntries
                .sort((a, b) => {
                  const mealOrderA =
                    mealTypeConfig[a.meal_type as keyof typeof mealTypeConfig]
                      ?.order || 999;
                  const mealOrderB =
                    mealTypeConfig[b.meal_type as keyof typeof mealTypeConfig]
                      ?.order || 999;
                  if (mealOrderA !== mealOrderB) {
                    return mealOrderA - mealOrderB;
                  }
                  return (
                    new Date(a.consumed_at).getTime() -
                    new Date(b.consumed_at).getTime()
                  );
                })
                .map((entry) => {
                  const config =
                    mealTypeConfig[
                      entry.meal_type as keyof typeof mealTypeConfig
                    ];
                  return (
                    <div className="contents" key={entry.id}>
                      <div>
                        <div className="flex items-center gap-2">
                          <Icon
                            name={config?.iconName ?? "sparkles"}
                            size={18}
                            aria-hidden
                            className="text-primary"
                          />
                          <span className="text-base font-medium text-base-content">
                            {config?.label || entry.meal_type}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-medium text-base-content">
                            {entry.food_name}
                          </span>
                          {entry.calories && (
                            <span className="text-base bg-primary/10 text-primary px-2 py-1 rounded">
                              {t("mealSections.calories", {
                                calories: Math.round(entry.calories),
                              })}
                            </span>
                          )}
                        </div>
                        {entry.notes && (
                          <div className="text-base text-base-content/60 mt-1 truncate max-w-xs">
                            {entry.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-base font-medium text-base-content">
                          {entry.portion_size_g}g
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-base font-medium text-base-content">
                          {formatTime(entry.consumed_at)}
                        </span>
                      </div>
                      <div className="flex justify-end gap-1">
                        <ActionButton
                          label={t("common.edit")}
                          iconName="edit"
                          color="neutral"
                          size="xs"
                          variant="ghost"
                          iconOnly
                          onClick={() => {
                            // TODO: 编辑功能 - 可以后续实现
                          }}
                        />
                        <ActionButton
                          label={t("common.delete")}
                          iconName="trash"
                          color="error"
                          size="xs"
                          variant="ghost"
                          iconOnly
                          onClick={() => handleDelete(entry)}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* 快速添加输入框 - 只显示一个 */}
          {hasAnyQuickAdd && (
            <div className="border-t border-base-200 p-2 mt-4">
              {sortedMealTypes.map((mealType) => {
                if (!showQuickAdd[mealType]) return null;
                return (
                  <div
                    key={mealType}
                    className="bg-primary/10 border border-primary/20 rounded p-2"
                  >
                    <InlineQuickFoodEntry
                      selectedDate={selectedDate}
                      mealType={mealType}
                      onEntryCreated={handleQuickAddSuccess}
                      onError={handleQuickAddError}
                      onCancel={() => handleQuickAddCancel(mealType)}
                      onMealTypeChange={handleMealTypeChange}
                      variant="plain"
                      idPrefix={`quick-food-${mealType}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ListContainer>

      {/* Delete Confirmation Dialog */}
      {deletingEntry && (
        <ConfirmDialog
          isOpen={!!deletingEntry}
          title={t("mealSections.deleteTitle")}
          message={t("mealSections.deleteMessage", {
            foodName: deletingEntry.food_name,
          })}
          confirmText={t("common.delete")}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </>
  );
}
