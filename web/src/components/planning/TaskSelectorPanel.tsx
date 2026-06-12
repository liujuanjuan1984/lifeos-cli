import React from "react";
import { useTranslation } from "react-i18next";
import TaskSelector from "@/components/selects/TaskSelector";
import ActionButton, { FormActions } from "@/components/ActionButton";
import type { UUID } from "@/types/primitive";

interface TaskSelectorPanelProps {
  groupId: string;
  groupLabel: string;
  selectedTaskId: UUID | null;
  onTaskSelectorChange: (taskId: UUID | null) => void;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
  isAddingTask: boolean;
  planningTaskFilterStatus: readonly string[];
}

export const TaskSelectorPanel: React.FC<TaskSelectorPanelProps> = ({
  groupId,
  groupLabel,
  selectedTaskId,
  onTaskSelectorChange,
  onSubmit,
  onCancel,
  isAddingTask,
  planningTaskFilterStatus,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-medium text-primary">
          {t("planning.taskActions.addTask", { period: groupLabel })}
        </h4>
        <ActionButton
          label={t("common.cancel")}
          iconName="x-mark"
          color="primary"
          size="xs"
          variant="ghost"
          iconOnly
          onClick={onCancel}
        />
      </div>

      <TaskSelector
        value={selectedTaskId}
        onChange={onTaskSelectorChange}
        disabled={isAddingTask}
        filterStatus={planningTaskFilterStatus}
        idPrefix={`planning-task-selector-${groupId}`}
        className="mb-3"
      />

      <div className="mt-3">
        <FormActions
          loading={isAddingTask}
          disabled={!selectedTaskId || isAddingTask}
          submitText={
            isAddingTask
              ? t("planning.addTask.addingText")
              : t("planning.addTask.submitText")
          }
          cancelText={t("common.cancel")}
          submitColor="primary"
          onSubmit={() => {
            void onSubmit();
          }}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};
