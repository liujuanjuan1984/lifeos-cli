import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import ModalBase from "@/layouts/ModalBase";
import { FormActions } from "./ActionButton";
import { TextInput } from "./forms";
import DimensionSelect from "./selects/DimensionSelect";
import PersonSelector from "./selects/PersonSelector";
import type { UUID } from "@/types/primitive";
import type { ActualEventTemplate } from "@/services/api/actualEventTemplates";

export interface QuickTemplateEditorValues {
  title: string;
  dimension_id: UUID | null;
  person_ids: UUID[];
  default_duration_minutes?: number | null;
}

interface QuickTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: QuickTemplateEditorValues) => Promise<void> | void;
  initialTemplate?: ActualEventTemplate | null;
  submitting?: boolean;
  errorMessage?: string | null;
}

interface FormState {
  title: string;
  dimensionId: UUID | null;
  personIds: UUID[];
  durationText: string;
}

const emptyState: FormState = {
  title: "",
  dimensionId: null,
  personIds: [],
  durationText: "",
};

const QuickTemplateEditorModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialTemplate,
  submitting = false,
  errorMessage,
}: QuickTemplateEditorModalProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(emptyState);

  useEffect(() => {
    if (isOpen) {
      if (initialTemplate) {
        setForm({
          title: initialTemplate.title,
          dimensionId: initialTemplate.dimension_id,
          personIds:
            initialTemplate.person_ids && initialTemplate.person_ids.length > 0
              ? initialTemplate.person_ids
              : (initialTemplate.persons?.map((person) => person.id) ?? []),
          durationText: initialTemplate.default_duration_minutes
            ? String(initialTemplate.default_duration_minutes)
            : "",
        });
      } else {
        setForm(emptyState);
      }
    }
  }, [isOpen, initialTemplate]);

  const isValidTitle = form.title.trim().length > 0;
  const isValidDuration = useMemo(() => {
    if (!form.durationText) return true;
    const value = Number(form.durationText);
    return Number.isFinite(value) && value > 0 && value <= 1440;
  }, [form.durationText]);

  const canSubmit = isValidTitle && isValidDuration && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload: QuickTemplateEditorValues = {
      title: form.title.trim(),
      dimension_id: form.dimensionId,
      person_ids: form.personIds,
      default_duration_minutes: form.durationText
        ? Number(form.durationText)
        : undefined,
    };
    await onSubmit(payload);
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      header={
        initialTemplate
          ? t("quickTemplatesManager.editTemplate")
          : t("quickTemplatesManager.addTemplate")
      }
      size="lg"
      loading={submitting}
      showLoadingSpinner={submitting}
      showCloseButton={true}
      error={errorMessage ?? undefined}
      onErrorDismiss={undefined}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="quick-template-title"
              className="block text-sm font-medium text-base-content mb-1"
            >
              {t("quickTemplatesManager.activityDescription")}
            </label>
            <TextInput
              id="quick-template-title"
              name="quick-template-title"
              type="text"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              size="md"
              placeholder={t("quickTemplatesManager.activityPlaceholder")}
              disabled={submitting}
            />
            {!isValidTitle && (
              <p className="mt-1 text-sm text-error">
                {t("quickTemplatesManager.validation.titleRequired")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="quick-template-duration"
              className="block text-sm font-medium text-base-content mb-1"
            >
              {t("quickTemplatesManager.durationOptional")}
            </label>
            <TextInput
              id="quick-template-duration"
              name="quick-template-duration"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.durationText}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  durationText: event.target.value,
                }))
              }
              size="md"
              placeholder={t("quickTemplatesManager.durationPlaceholder")}
              disabled={submitting}
            />
            {!isValidDuration && (
              <p className="mt-1 text-sm text-error">
                {t("quickTemplatesManager.validation.durationInvalid")}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <DimensionSelect
              value={form.dimensionId}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  dimensionId: (value ?? null) as UUID | null,
                }))
              }
              id="quick-template-dimension"
              label={t("target.dimension")}
              showLabel={true}
              disabled={submitting}
            />
          </div>

          <div>
            <PersonSelector
              idPrefix="quick-template-person"
              selectedPersonIds={form.personIds}
              onSelectionChange={(personIds) =>
                setForm((prev) => ({ ...prev, personIds }))
              }
              label={t("timeLog.table.relatedPerson")}
              showLabel
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <FormActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          disabled={!canSubmit}
          cancelText={t("common.cancel")}
        />
      </div>
    </ModalBase>
  );
};

export default QuickTemplateEditorModal;
