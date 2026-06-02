import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ModalBase from "@/layouts/ModalBase";

import {
  type HabitCreate,
  type HabitUpdate,
  type Habit,
} from "@/services/api/habits";
import { useToast } from "@/contexts/ToastContext";
import { logger } from "@/utils/core";
import TaskSelector from "@/components/selects/TaskSelector";
import { DeleteButton, FormActions } from "@/components/ActionButton";
import EnumSelect from "@/components/selects/EnumSelect";
import { FormField, TextInput, TextArea } from "@/components/forms";
import {
  HABIT_STATUS_FILTER_OPTIONS,
  HABIT_DURATION_OPTIONS,
  ACTIVE_TASK_STATUSES,
} from "@/utils/constants";
import type { UUID } from "@/types/primitive";
import { getTodayDateString } from "@/utils/datetime";

interface HabitFormModalProps {
  open: boolean;
  onClose: () => void;
  habitToEdit?: Habit | null;
  prefillHabit?: HabitPrefill | null;
  onCreateHabit?: (habit: HabitCreate) => Promise<Habit>;
  onUpdateHabit?: (id: UUID, habit: HabitUpdate) => Promise<Habit>;
  onRequestDelete?: (habit: Habit) => void;
}

interface HabitPrefill {
  title: string;
  description?: string | null;
  duration_days: number;
  task_id?: UUID | null;
}

export function HabitFormModal({
  open,
  onClose,
  habitToEdit,
  prefillHabit,
  onCreateHabit,
  onUpdateHabit,
  onRequestDelete,
}: HabitFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [durationDays, setDurationDays] = useState<number>(7);
  const [selectedTaskId, setSelectedTaskId] = useState<UUID | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskSelectionTouched, setTaskSelectionTouched] = useState(false);

  const { t } = useTranslation();
  const toast = useToast();
  const isEditMode = !!habitToEdit;
  const taskFilterStatus = useMemo(() => ACTIVE_TASK_STATUSES, []);

  // Initialize form data when habitToEdit changes
  useEffect(() => {
    setTaskSelectionTouched(false);
    if (habitToEdit) {
      setTitle(habitToEdit.title);
      setDescription(habitToEdit.description || "");
      setStartDate(habitToEdit.start_date);
      setDurationDays(habitToEdit.duration_days);
      setSelectedTaskId(habitToEdit.task_id || null);
      setStatus(habitToEdit.status);
    } else if (prefillHabit) {
      setTitle(prefillHabit.title);
      setDescription(prefillHabit.description || "");
      setStartDate(getTodayDateString());
      setDurationDays(prefillHabit.duration_days);
      setSelectedTaskId(prefillHabit.task_id || null);
      setStatus("active");
    } else {
      // Reset form for create mode
      setTitle("");
      setDescription("");
      setStartDate(getTodayDateString());
      setDurationDays(7);
      setSelectedTaskId(null);
      setStatus("active");
    }
  }, [habitToEdit, prefillHabit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(t("habitForm.validation.titleRequired"));
      return;
    }

    if (!startDate) {
      setError(t("habitForm.validation.startDateRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditMode && habitToEdit && onUpdateHabit) {
        // Edit mode
        const shouldSendTaskId = !isEditMode || taskSelectionTouched;
        const nextTaskId = selectedTaskId ?? null;
        const updateData: HabitUpdate = {
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startDate,
          duration_days: durationDays,
          status: status,
        };
        if (shouldSendTaskId) {
          updateData.task_id = nextTaskId;
        }

        await onUpdateHabit(habitToEdit.id, updateData);
        toast.showSuccess(t("habitForm.messages.updateSuccess"));
      } else if (!isEditMode && onCreateHabit) {
        // Create mode
        const nextTaskId = selectedTaskId ?? null;
        const habitData: HabitCreate = {
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startDate,
          duration_days: durationDays,
          task_id: nextTaskId,
        };

        await onCreateHabit(habitData);
        toast.showSuccess(t("habitForm.messages.createSuccess"));
      } else {
        throw new Error("Missing required mutation functions");
      }

      // 操作成功后关闭模态框
      onClose();
    } catch (err) {
      const action = isEditMode
        ? t("habitForm.messages.updateFailed")
        : t("habitForm.messages.createFailed");
      const message = err instanceof Error ? err.message : action;
      setError(message);
      logger.error(`Failed to ${isEditMode ? "update" : "create"} habit:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      // 重置表单状态
      setTitle("");
      setDescription("");
      setStartDate(getTodayDateString());
      setDurationDays(7);
      setSelectedTaskId(null);
      setStatus("active");
      setError(null);
      setTaskSelectionTouched(false);
      onClose();
    }
  };

  const handleErrorDismiss = () => {
    setError(null);
  };

  const formId = "habit-form";

  return (
    <ModalBase
      isOpen={open}
      onClose={handleClose}
      title={isEditMode ? t("habitForm.editTitle") : t("habits.createNew")}
      size="lg"
      loading={loading}
      showLoadingSpinner={true}
      showLoadingOverlay={true}
      loadingOverlayText={
        isEditMode
          ? t("habitForm.messages.updating")
          : t("habitForm.messages.creating")
      }
      error={error}
      onErrorDismiss={handleErrorDismiss}
      errorDisplayMode="inline"
      overlayClosable={false}
      footer={
        <FormActions
          loading={loading}
          onCancel={handleClose}
          onSubmit={() => {
            const form = document.getElementById(
              formId,
            ) as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          submitColor="primary"
          cancelColor="neutral"
          leftSlot={
            isEditMode && habitToEdit ? (
              <DeleteButton
                showLabel={true}
                size="md"
                onClick={() => {
                  if (loading) return;
                  handleClose();
                  onRequestDelete?.(habitToEdit);
                }}
                disabled={loading}
              />
            ) : undefined
          }
        />
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="space-y-3 sm:space-y-4 lg:space-y-5"
      >
        <FormField label={t("habitForm.fields.title")} htmlFor="title" required>
          <TextInput
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("habitForm.fields.titlePlaceholder")}
            disabled={loading}
            required
          />
        </FormField>

        <FormField
          label={t("visions.vision.description")}
          htmlFor="description"
        >
          <TextArea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("habitForm.fields.descriptionPlaceholder")}
            disabled={loading}
            rows={3}
          />
        </FormField>

        <div className="space-y-1 sm:space-y-2">
          <TaskSelector
            value={selectedTaskId ?? null}
            onChange={(taskId) => {
              setTaskSelectionTouched(true);
              setSelectedTaskId(taskId);
            }}
            placeholder={t("task.selectTaskPlaceholder")}
            disabled={loading}
            className="text-sm sm:text-base"
            filterStatus={taskFilterStatus}
            idPrefix="habit-form"
          />
        </div>

        <FormField
          label={t("taskForm.planning.startLabels.day")}
          htmlFor="startDate"
          required
          description={t("habitForm.fields.startDateHint")}
        >
          <TextInput
            id="startDate"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
            required
          />
        </FormField>

        {/* Duration and Status in responsive grid layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <EnumSelect
              id="habit-form-duration"
              value={String(durationDays)}
              onChange={(value) => {
                if (value) {
                  setDurationDays(parseInt(value));
                }
              }}
              disabled={loading}
              options={HABIT_DURATION_OPTIONS}
              label={`${t("habitForm.fields.duration")} *`}
            />
          </div>

          {/* Status field - only show in edit mode */}
          {isEditMode && (
            <div className="space-y-1 sm:space-y-2">
              <EnumSelect
                id="habit-form-status"
                value={status}
                onChange={(value) => {
                  if (value) {
                    setStatus(value as string);
                  }
                }}
                disabled={loading}
                options={HABIT_STATUS_FILTER_OPTIONS}
                label={t("habitForm.fields.status")}
              />
            </div>
          )}
        </div>
      </form>
    </ModalBase>
  );
}
