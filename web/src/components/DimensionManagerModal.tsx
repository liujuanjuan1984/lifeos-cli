import React from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import ActionButton, {
  ActionButtonGroup,
  FormActions,
  EditButton,
  DeleteButton,
  CreateNewButton,
} from "./ActionButton";
import ConfirmDialog from "./ConfirmDialog";
import EnumSelect from "./selects/EnumSelect";
import { FormField, TextInput, TextArea, Checkbox } from "./forms";
import { useDimensionManagerController } from "@/features/dimensions/controller/useDimensionManagerController";

interface DimensionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * DimensionManagerModal
 * A comprehensive modal component for managing life dimensions.
 * Handles all dimension CRUD operations with a unified interface.
 */
const DimensionManagerModal: React.FC<DimensionManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const {
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
    clearDeletingDimension,
  } = useDimensionManagerController({
    isOpen,
    onClose,
  });

  // Common color palette for dimensions
  const colorPalette = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#8B5CF6", // Purple
    "#EF4444", // Red
    "#F97316", // Orange
    "#06B6D4", // Cyan
    "#84CC16", // Lime
    "#EC4899", // Pink
    "#6366F1", // Indigo
  ];

  // Common icons for dimensions
  const iconOptions = [
    { value: "work", label: t("dimensionManager.icons.work") },
    { value: "health", label: t("dimensionManager.icons.health") },
    { value: "family", label: t("dimensionManager.icons.family") },
    { value: "learning", label: t("dimensionManager.icons.learning") },
    { value: "creativity", label: t("dimensionManager.icons.creativity") },
    { value: "social", label: t("dimensionManager.icons.social") },
    { value: "finance", label: t("dimensionManager.icons.finance") },
    { value: "hobby", label: t("dimensionManager.icons.hobby") },
    { value: "travel", label: t("dimensionManager.icons.travel") },
    { value: "spirituality", label: t("dimensionManager.icons.spirituality") },
  ];

  if (loading) {
    return (
      <ModalBase
        isOpen={isOpen}
        onClose={onClose}
        ariaLabelledBy="dimension-manager-title"
        size="xl"
        header={t("dimensionManager.title")}
      >
        <div className="flex items-center justify-center h-64 text-base-content/60">
          {t("dimensionManager.loadingDimensions")}
        </div>
      </ModalBase>
    );
  }

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="dimension-manager-title"
      size="2xl"
      header={t("dimensionManager.title")}
      loading={loading}
      showLoadingOverlay={false}
      showLoadingSpinner={true}
      loadingSpinnerSize="md"
      showCloseButton={true}
      errorDisplayMode="none"
    >
      <div className="flex justify-center mb-6">
        <CreateNewButton
          label={t("dimensionManager.addNewDimension")}
          onClick={() => setShowForm(true)}
        />
      </div>

      {/* Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {dimensions.map((dimension) => (
          <div
            key={dimension.id}
            className={`p-4 rounded-lg border-2 transition-all ${
              dimension.is_active
                ? "border-base-200 bg-base-100 shadow-sm"
                : "border-base-200 bg-base-200 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: dimension.color }}
                />
                <h3 className="font-semibold text-base-content">
                  {dimension.name}
                </h3>
              </div>
              <ActionButtonGroup gap="sm" align="end">
                <EditButton onClick={() => handleEdit(dimension)} />
                <ActionButton
                  label={dimension.is_active ? "" : ""}
                  iconName="eye"
                  color="neutral"
                  size="sm"
                  onClick={() => void toggleActive(dimension)}
                  title={
                    dimension.is_active
                      ? t("dimensionManager.toggleActive")
                      : t("dimensionManager.toggleInactive")
                  }
                />
                <DeleteButton onClick={() => requestDelete(dimension)} />
              </ActionButtonGroup>
            </div>

            {dimension.description && (
              <p className="text-base text-base-content mb-2">
                {dimension.description}
              </p>
            )}

            {dimension.icon && (
              <div className="text-base text-base-content/60">
                {t("dimensionManager.iconLabel")}{" "}
                {iconOptions.find((opt) => opt.value === dimension.icon)
                  ?.label || dimension.icon}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <ModalBase
          isOpen={showForm}
          onClose={resetForm}
          ariaLabelledBy="dimension-form-title"
          overlayClassName="fixed inset-0 bg-base-content/50 flex items-center justify-center z-modal-nested p-4"
          className="bg-base-100 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto z-modal-nested"
          loading={loading}
          showLoadingOverlay={false}
          showLoadingSpinner={true}
          loadingSpinnerSize="md"
          showCloseButton={true}
          errorDisplayMode="none"
        >
          <h3
            id="dimension-form-title"
            className="text-lg font-bold font-semibold text-base-content mb-4"
          >
            {editingDimension
              ? t("dimensionManager.editDimension")
              : t("dimensionManager.addNewDimension")}
          </h3>

          <form onSubmit={saveDimension} className="space-y-4">
            <FormField
              label={t("dimensionManager.dimensionName")}
              htmlFor="dimension-name"
              required
            >
              <TextInput
                id="dimension-name"
                name="dimension-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                placeholder={t("dimensionManager.dimensionNamePlaceholder")}
                size="sm"
              />
            </FormField>

            <FormField
              label={t("visions.vision.description")}
              htmlFor="dimension-description"
            >
              <TextArea
                id="dimension-description"
                name="dimension-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={2}
                placeholder={t("dimensionManager.descriptionPlaceholder")}
                size="sm"
              />
            </FormField>

            <div>
              <label className="block text-base font-medium text-base-content mb-1">
                {t("dimensionManager.color")}
              </label>
              <div className="flex space-x-2 mb-2">
                {colorPalette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color
                        ? "border-base-content"
                        : "border-base-300"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <input
                id="dimension-color"
                name="dimension-color"
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, color: e.target.value }))
                }
                className="w-full h-10 border border-base-300 rounded-md"
              />
            </div>

            <div>
              <div className="min-w-[180px]">
                <EnumSelect
                  id="dimension-manager-icon"
                  value={formData.icon}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      icon: value as string,
                    }))
                  }
                  options={[
                    {
                      value: "",
                      label: t("dimensionManager.iconPlaceholder"),
                    },
                    ...iconOptions,
                  ]}
                  showLabel={true}
                  label={t("dimensionManager.icon")}
                />
              </div>
            </div>

            <Checkbox
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  is_active: checked,
                }))
              }
              label={t("dimensionManager.enableDimension")}
              variant="primary"
              size="md"
            />

            <FormActions
              onCancel={resetForm}
              onSubmit={() => document.querySelector("form")?.requestSubmit()}
            />
          </form>
        </ModalBase>
      )}

      {/* Confirmation Dialog */}
      {deletingDimension && (
        <ConfirmDialog
          isOpen={!!deletingDimension}
          title={t("dimensionManager.deleteConfirmTitle")}
          message={t("dimensionManager.deleteConfirmMessage", {
            name: deletingDimension.name,
          })}
          confirmText={t("common.delete")}
          onConfirm={() => void confirmDelete()}
          onCancel={clearDeletingDimension}
        />
      )}
    </ModalBase>
  );
};

export default DimensionManagerModal;
