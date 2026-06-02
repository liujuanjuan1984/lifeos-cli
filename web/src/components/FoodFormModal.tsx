import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "./ActionButton";
import {
  foodsApi,
  type Food,
  type FoodCreate,
  type FoodUpdate,
} from "@/services/api";
import { logger } from "@/utils/core";
import { useModalState } from "@/hooks/useModalState";
import { useToast } from "@/contexts/ToastContext";
import { FormField, TextInput, Checkbox } from "./forms";

interface FoodFormModalProps {
  food?: Food | null;
  onClose: () => void;
  onCreated: (food: Food) => void;
  onUpdated: (food: Food) => void;
}

export default function FoodFormModal({
  food,
  onClose,
  onCreated,
  onUpdated,
}: FoodFormModalProps) {
  const { t } = useTranslation();
  const { loading, withLoading } = useModalState();
  const [formData, setFormData] = useState({
    name: food?.name || "",
    is_common: food?.is_common || false,
    calories_per_100g: food?.calories_per_100g || "",
    protein_per_100g: food?.protein_per_100g || "",
    carbs_per_100g: food?.carbs_per_100g || "",
    fat_per_100g: food?.fat_per_100g || "",
  });

  const isEditing = !!food;
  const toast = useToast();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.showError(
        t("foodForm.validationFailed"),
        t("quickFoodEntry.validation.foodNameRequired"),
      );
      return;
    }

    try {
      await withLoading(async () => {
        const numericFields = {
          calories_per_100g:
            formData.calories_per_100g === ""
              ? undefined
              : Number(formData.calories_per_100g),
          protein_per_100g:
            formData.protein_per_100g === ""
              ? undefined
              : Number(formData.protein_per_100g),
          carbs_per_100g:
            formData.carbs_per_100g === ""
              ? undefined
              : Number(formData.carbs_per_100g),
          fat_per_100g:
            formData.fat_per_100g === ""
              ? undefined
              : Number(formData.fat_per_100g),
        };

        if (isEditing) {
          const updatePayload: FoodUpdate = {
            name: formData.name.trim(),
            is_common: !!formData.is_common,
            ...numericFields,
          };
          const updatedFood = await foodsApi.updateFood(food.id, updatePayload);
          onUpdated(updatedFood);

          toast.showSuccess(
            t("foodForm.updateSuccess"),
            t("foodForm.updateSuccessMessage", { name: formData.name.trim() }),
          );
        } else {
          const createPayload: FoodCreate = {
            name: formData.name.trim(),
            is_common: !!formData.is_common,
            ...numericFields,
          };
          const newFood = await foodsApi.createFood(createPayload);
          onCreated(newFood);

          toast.showSuccess(
            t("foodForm.createSuccess"),
            t("foodForm.createSuccessMessage", { name: formData.name.trim() }),
          );
        }

        onClose();
      });
    } catch (err) {
      logger.error("Failed to save food", err);

      toast.showError(t("foodForm.saveFailed"), t("calendar.saveFailed"));
    }
  };

  // Handle form field changes
  const handleFieldChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle numeric field changes
  const handleNumericChange = (field: string, value: string) => {
    // Allow empty string or valid numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const formId = "food-form";

  return (
    <ModalBase
      isOpen={true}
      onClose={onClose}
      loading={loading}
      showLoadingOverlay={false}
      showLoadingSpinner={true}
      loadingSpinnerSize="md"
      showCloseButton={true}
      errorDisplayMode="none"
      title={
        isEditing ? t("foodForm.editFood") : t("foodLibrarySidebar.addFood")
      }
      size="lg"
      footer={
        <FormActions
          loading={loading}
          onCancel={onClose}
          onSubmit={() => {
            const form = document.getElementById(
              formId,
            ) as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          submitColor="primary"
          cancelColor="neutral"
        />
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="space-y-6"
        aria-label={
          isEditing ? t("foodForm.editFoodForm") : t("foodForm.addFoodForm")
        }
      >
        {/* Basic Information */}
        <div className="space-y-4">
          <FormField
            label={t("mealSections.tableHeaders.foodName")}
            htmlFor="name"
            required
          >
            <TextInput
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder={t("foodForm.namePlaceholder")}
              required
              autoComplete="off"
              size="sm"
            />
          </FormField>

          <Checkbox
            id="is_common"
            name="is_common"
            checked={formData.is_common}
            onCheckedChange={(checked) =>
              handleFieldChange("is_common", checked)
            }
            label={t("foodForm.markAsCommon")}
            variant="primary"
            size="md"
          />
        </div>

        {/* Nutrition Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold font-medium text-base-content">
            {t("foodForm.nutritionInfo")}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t("nutritionSummarySidebar.calories")}
              htmlFor="calories_per_100g"
              description={t("foodForm.caloriesUnit")}
            >
              <TextInput
                id="calories_per_100g"
                name="calories_per_100g"
                type="text"
                value={formData.calories_per_100g}
                onChange={(e) =>
                  handleNumericChange("calories_per_100g", e.target.value)
                }
                placeholder="0"
                size="sm"
              />
            </FormField>

            <FormField
              label={t("nutritionSummarySidebar.protein")}
              htmlFor="protein_per_100g"
              description={t("foodForm.grams")}
            >
              <TextInput
                id="protein_per_100g"
                name="protein_per_100g"
                type="text"
                value={formData.protein_per_100g}
                onChange={(e) =>
                  handleNumericChange("protein_per_100g", e.target.value)
                }
                placeholder="0"
                size="sm"
              />
            </FormField>

            <FormField
              label={t("nutritionSummarySidebar.carbs")}
              htmlFor="carbs_per_100g"
              description={t("foodForm.grams")}
            >
              <TextInput
                id="carbs_per_100g"
                name="carbs_per_100g"
                type="text"
                value={formData.carbs_per_100g}
                onChange={(e) =>
                  handleNumericChange("carbs_per_100g", e.target.value)
                }
                placeholder="0"
                size="sm"
              />
            </FormField>

            <FormField
              label={t("nutritionSummarySidebar.fat")}
              htmlFor="fat_per_100g"
              description={t("foodForm.grams")}
            >
              <TextInput
                id="fat_per_100g"
                name="fat_per_100g"
                type="text"
                value={formData.fat_per_100g}
                onChange={(e) =>
                  handleNumericChange("fat_per_100g", e.target.value)
                }
                placeholder="0"
                size="sm"
              />
            </FormField>
          </div>
        </div>
      </form>
    </ModalBase>
  );
}
