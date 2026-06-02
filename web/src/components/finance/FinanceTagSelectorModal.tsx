import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";
import TagSelector from "@/components/selects/TagSelector";
import ActionButton from "@/components/ActionButton";
import { useToast } from "@/contexts/ToastContext";
import { useTagSelectorSource } from "@/hooks/selectors/useTagSelectorSource";
import type { UUID } from "@/types/primitive";

interface FinanceTagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTagIds: UUID[];
  onSave: (tagIds: UUID[]) => Promise<void> | void;
}

function FinanceTagSelectorModal({
  isOpen,
  onClose,
  selectedTagIds,
  onSave,
}: FinanceTagSelectorModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { tags, loading, error, refresh, createTag } = useTagSelectorSource({
    entityType: "note",
  });
  const [localSelection, setLocalSelection] = useState<UUID[]>(selectedTagIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocalSelection(selectedTagIds);
  }, [isOpen, selectedTagIds]);

  const handleCreateTag = useCallback(
    async (tagName: string) => {
      try {
        const created = await createTag(tagName);
        toast.showSuccess(
          t("finance.tagSelector.createSuccess", { name: created.name }),
        );
        return created;
      } catch (err) {
        toast.showError(
          t("finance.tagSelector.createFailed"),
          err instanceof Error ? err.message : undefined,
        );
        throw err;
      }
    },
    [createTag, toast, t],
  );

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(localSelection);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [localSelection, onSave, onClose]);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      header={t("finance.tagSelector.title")}
      showCloseButton
      size="lg"
      loading={loading}
      error={error ?? undefined}
      onErrorDismiss={() => refresh()}
      showLoadingSpinner={loading}
    >
      <div className="space-y-4">
        <p className="text-sm text-base-content/80">
          {t("finance.tagSelector.description")}
        </p>

        <TagSelector
          availableTags={tags}
          selectedTagIds={localSelection}
          onTagsChange={setLocalSelection}
          onCreateTag={handleCreateTag}
          size="md"
          idPrefix="finance-tag-selector"
          showNoTagOption={false}
        />

        <div className="flex justify-end gap-2">
          <ActionButton
            label={t("common.cancel")}
            onClick={onClose}
            variant="ghost"
            size="sm"
            disabled={saving}
          />
          <ActionButton
            label={t("common.save")}
            onClick={handleSubmit}
            color="primary"
            variant="solid"
            size="sm"
            disabled={saving}
          />
        </div>
      </div>
    </ModalBase>
  );
}

export default FinanceTagSelectorModal;
