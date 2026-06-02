import React from "react";
import { useTranslation } from "react-i18next";
import VisionSelector from "@/components/selects/VisionSelector";
import { TextInput } from "@/components/forms";
import ActionButton, { FormActions } from "@/components/ActionButton";
import type { UUID } from "@/types/primitive";

interface TaskCreationPanelProps {
  groupId: string;
  groupLabel: string;
  selectedVisionId: UUID | null;
  onVisionChange: (visionId: UUID | null) => void;
  isCreatingTask: boolean;
  newTaskContent: string;
  onTaskContentChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export const TaskCreationPanel: React.FC<TaskCreationPanelProps> = ({
  groupId,
  groupLabel,
  selectedVisionId,
  onVisionChange,
  isCreatingTask,
  newTaskContent,
  onTaskContentChange,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-success/10 border border-success/20 rounded-lg p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-medium text-success">
          {t("planning.taskActions.createTask", { period: groupLabel })}
        </h4>
        <ActionButton
          label={t("common.cancel")}
          iconName="x-mark"
          color="success"
          size="xs"
          variant="ghost"
          iconOnly
          onClick={onCancel}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-10 gap-3">
        <div className="md:col-span-3">
          <VisionSelector
            value={selectedVisionId}
            onChange={onVisionChange}
            placeholder={t("planning.createTask.visionPlaceholder")}
            disabled={isCreatingTask}
            showDefaultOption
            defaultToInboxVision
            idPrefix={`create-task-vision-${groupId}`}
            className="w-full"
          />
        </div>

        <div className="md:col-span-7">
          <TextInput
            id={`new-task-content-${groupId}`}
            name="new-task-content"
            value={newTaskContent}
            onChange={(event) => onTaskContentChange(event.target.value)}
            placeholder={t("planning.createTask.contentPlaceholder")}
            disabled={isCreatingTask}
            className="text-base disabled:opacity-50 disabled:cursor-not-allowed"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSubmit();
              }
            }}
            autoFocus
          />
        </div>
      </div>

      <div className="mt-3">
        <FormActions
          loading={isCreatingTask}
          disabled={
            !newTaskContent.trim() || !selectedVisionId || isCreatingTask
          }
          submitText={
            isCreatingTask
              ? t("tagManager.actions.creating")
              : t("planning.createTask.submitText")
          }
          cancelText={t("common.cancel")}
          submitColor="success"
          onSubmit={() => {
            void onSubmit();
          }}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};
