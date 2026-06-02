import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  FoodEntryCreate,
  FoodSummary,
  FoodEntrySummary,
} from "@/services/api";
import { foodEntriesApi, foodsApi } from "@/services/api";
import { FormActions } from "./ActionButton";
import { useToast } from "@/contexts/ToastContext";
import { logger } from "@/utils/core";
import EnumSelect from "./selects/EnumSelect";
import { TextInput } from "./forms";
import type { UUID } from "@/types/primitive";
import type { SelectorValue } from "./selects/selectorTypes";
import { Icon } from "./icons";

interface InlineQuickFoodEntryProps {
  selectedDate: string;
  mealType: string;
  onEntryCreated: (entry: FoodEntrySummary) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  onMealTypeChange?: (mealType: string) => void;
  /**
   * Visual variant. "accent" shows blue accent background and borders (default).
   * "plain" renders without decorative wrappers, suitable for embedding
   * inside already-styled containers.
   */
  variant?: "accent" | "plain";
  /** Prefix for generating unique IDs */
  idPrefix?: string;
}

export default function InlineQuickFoodEntry({
  selectedDate,
  mealType,
  onEntryCreated,
  onError,
  onCancel,
  onMealTypeChange,
  variant = "accent",
  idPrefix = "quick-food",
}: InlineQuickFoodEntryProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    foodName: "",
    portionSize: 100,
    notes: "",
  });
  const [selectedFood, setSelectedFood] = useState<FoodSummary | null>(null);
  const [foodSuggestions, setFoodSuggestions] = useState<FoodSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentMealType, setCurrentMealType] = useState(mealType);

  // 餐次选项
  const mealTypeOptions = [
    { value: "breakfast", label: t("quickFoodEntry.mealType.breakfast") },
    { value: "lunch", label: t("quickFoodEntry.mealType.lunch") },
    { value: "dinner", label: t("quickFoodEntry.mealType.dinner") },
    { value: "snack", label: t("quickFoodEntry.mealType.snack") },
  ];

  const toast = useToast();

  // Refs for keyboard navigation
  const foodNameRef = useRef<HTMLInputElement>(null);
  const portionSizeRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);

  // Focus food name input when component mounts
  useEffect(() => {
    setTimeout(() => {
      foodNameRef.current?.focus();
    }, 100);
  }, []);

  // 处理餐次变更
  const handleMealTypeChange = (newMealType: SelectorValue) => {
    if (typeof newMealType === "string" && newMealType !== "") {
      setCurrentMealType(newMealType);
      onMealTypeChange?.(newMealType);
    }
  };

  // Search for food suggestions when food name changes
  useEffect(() => {
    const searchFoods = async () => {
      if (formData.foodName.trim().length < 2) {
        setFoodSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const foods = await foodsApi.getFoods({
          search: formData.foodName.trim(),
          page: 1,
          size: 10,
        });
        setFoodSuggestions(foods.items ?? []);
        setShowSuggestions(true);
      } catch (err) {
        logger.error("Failed to search foods", err);
        // Don't show error for search, just log it
      }
    };

    const timeoutId = setTimeout(searchFoods, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [formData.foodName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveEntry();
  };

  const saveEntry = async () => {
    // Validation
    if (!formData.foodName.trim()) {
      onError(t("quickFoodEntry.validation.foodNameRequired"));
      foodNameRef.current?.focus();
      return;
    }

    if (formData.portionSize <= 0) {
      onError(t("quickFoodEntry.validation.portionSizeRequired"));
      portionSizeRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      let foodId: UUID;

      // If a food is selected from suggestions, use its ID
      if (selectedFood) {
        foodId = selectedFood.id;
      } else {
        // Create a new food entry
        const newFood = await foodsApi.createFood({
          name: formData.foodName.trim(),
          is_common: false,
        });
        foodId = newFood.id;
      }

      // Create food entry
      const entryData: FoodEntryCreate = {
        date: selectedDate,
        consumed_at: new Date().toISOString(),
        meal_type: currentMealType,
        food_id: foodId,
        portion_size_g: formData.portionSize,
        notes: formData.notes.trim() || undefined,
      };

      const result = await foodEntriesApi.createFoodEntry(entryData);

      toast.showSuccess(
        t("quickFoodEntry.messages.saveSuccess"),
        t("quickFoodEntry.messages.saveSuccessMessage", {
          foodName: formData.foodName,
        }),
      );

      // Reset form state for next entry
      setFormData({
        foodName: "",
        portionSize: 100,
        notes: "",
      });
      setSelectedFood(null);
      setFoodSuggestions([]);
      setShowSuggestions(false);

      // Convert FoodEntry to FoodEntrySummary and notify parent
      const summary: FoodEntrySummary = {
        id: result.id,
        date: result.date,
        consumed_at: result.consumed_at,
        meal_type: result.meal_type,
        food_name: result.food.name,
        portion_size_g: result.portion_size_g,
        calories: result.calories,
        notes: result.notes,
      };
      onEntryCreated(summary);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("common.error");
      onError(errorMessage);

      toast.showError(
        t("quickFoodEntry.messages.saveFailed"),
        t("eventModal.errors.saveMessage", { error: errorMessage }),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEntry();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleFoodSelect = (food: FoodSummary) => {
    setSelectedFood(food);
    setFormData((prev) => ({
      ...prev,
      foodName: food.name,
    }));
    setShowSuggestions(false);
  };

  const handleFoodNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      foodName: value,
    }));
    setSelectedFood(null); // Clear selection when typing
  };
  const outerCls =
    variant === "accent"
      ? "bg-primary/10 border-l-4 border-primary p-4 animate-in slide-in-from-top-2 duration-200"
      : "";
  return (
    <div className={outerCls}>
      <div className="mb-3">
        <h4 className="text-lg font-bold font-semibold text-base-content flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Icon name="sparkles" size={20} aria-hidden />
            {t("quickFoodEntry.title")}
          </span>
          <span className="text-sm text-base-content/70">
            {t("quickFoodEntry.hint")}
          </span>
        </h4>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick input row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
          {/* Meal Type Selection */}
          <div className="flex-shrink-0 w-32">
            <EnumSelect
              id={`${idPrefix}-meal-type`}
              value={currentMealType}
              onChange={handleMealTypeChange}
              options={mealTypeOptions}
              placeholder={t("quickFoodEntry.mealType.placeholder")}
              disabled={loading}
              label={t("quickFoodEntry.mealType.label")}
            />
          </div>

          {/* Food Name */}
          <div className="flex-1 relative">
            <label
              htmlFor={`${idPrefix}-food-name`}
              className="block text-base font-medium text-base-content mb-1"
            >
              {t("quickFoodEntry.foodName.label")}
            </label>
            <TextInput
              ref={foodNameRef}
              id={`${idPrefix}-food-name`}
              name={`${idPrefix}-food-name`}
              type="text"
              value={formData.foodName}
              onChange={(e) => handleFoodNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("quickFoodEntry.foodName.placeholder")}
              size="sm"
              disabled={loading}
              autoComplete="off"
            />

            {/* Food Suggestions Dropdown */}
            {showSuggestions && foodSuggestions.length > 0 && (
              <div className="absolute z-dropdown w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {foodSuggestions.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleFoodSelect(food)}
                    className="w-full px-3 py-2 text-left hover:bg-base-200 flex items-center justify-between"
                  >
                    <span className="text-base text-base-content">
                      {food.name}
                    </span>
                    {food.calories_per_100g && (
                      <span className="text-sm text-base-content/60">
                        {Math.round(food.calories_per_100g)} 卡/100g
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Portion Size */}
          <div className="flex-shrink-0 w-24">
            <label
              htmlFor={`${idPrefix}-portion-size`}
              className="block text-base font-medium text-base-content mb-1"
            >
              {t("quickFoodEntry.portionSize.label")}
            </label>
            <TextInput
              ref={portionSizeRef}
              id={`${idPrefix}-portion-size`}
              name={`${idPrefix}-portion-size`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.portionSize ? String(formData.portionSize) : ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  portionSize: parseInt(e.target.value, 10) || 0,
                }))
              }
              onKeyDown={handleKeyDown}
              size="sm"
              disabled={loading}
            />
          </div>

          {/* Notes */}
          <div className="flex-1">
            <label
              htmlFor={`${idPrefix}-notes`}
              className="block text-base font-medium text-base-content mb-1"
            >
              {t("timeLog.modal.notes")}
            </label>
            <TextInput
              ref={notesRef}
              id={`${idPrefix}-notes`}
              name={`${idPrefix}-notes`}
              type="text"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              placeholder={t("quickFoodEntry.notes.placeholder")}
              size="sm"
              disabled={loading}
            />
          </div>
        </div>

        {/* Bottom action buttons */}
        <div className="pt-2">
          <FormActions
            loading={loading}
            onCancel={onCancel}
            onSubmit={() => document.querySelector("form")?.requestSubmit()}
            disabled={!formData.foodName.trim() || formData.portionSize <= 0}
          />
        </div>
      </form>
    </div>
  );
}
