import React, { useEffect, useMemo, useState } from "react";
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
import {
  CheckboxGroup,
  FormField,
  SegmentedControl,
  TextArea,
  TextInput,
} from "@/components/forms";
import {
  ACTIVE_TASK_STATUSES,
  HABIT_STATUS_FILTER_OPTIONS,
} from "@/utils/constants";
import type { UUID } from "@/types/primitive";
import {
  addDays,
  formatDateKey,
  getTodayDateString,
  parseDateStringToLocalDate,
} from "@/utils/datetime";

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

type HabitCadenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
type HabitEndMode = "repeat_count" | "until_date";

const WEEKDAY_OPTIONS = [
  { value: "monday", labelKey: "weekdays.monday" },
  { value: "tuesday", labelKey: "weekdays.tuesday" },
  { value: "wednesday", labelKey: "weekdays.wednesday" },
  { value: "thursday", labelKey: "weekdays.thursday" },
  { value: "friday", labelKey: "weekdays.friday" },
  { value: "saturday", labelKey: "weekdays.saturday" },
  { value: "sunday", labelKey: "weekdays.sunday" },
] as const;

function getHabitEndDate(startDate: string, durationDays: number): string {
  const parsedStart = parseDateStringToLocalDate(startDate);
  if (Number.isNaN(parsedStart.getTime())) return startDate;
  return formatDateKey(addDays(parsedStart, Math.max(durationDays, 1) - 1));
}

function parseMonthdays(value: string): number[] | null {
  const parts = value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const days = parts.map((part) => Number(part));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    return [];
  }
  return Array.from(new Set(days)).sort((a, b) => a - b);
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
  const today = getTodayDateString();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [cadenceFrequency, setCadenceFrequency] =
    useState<HabitCadenceFrequency>("daily");
  const [cadenceWeekdays, setCadenceWeekdays] = useState<string[]>([]);
  const [cadenceMonthdaysText, setCadenceMonthdaysText] = useState("");
  const [targetPerCycle, setTargetPerCycle] = useState(1);
  const [endMode, setEndMode] = useState<HabitEndMode>("repeat_count");
  const [repeatCount, setRepeatCount] = useState(100);
  const [endDate, setEndDate] = useState(getHabitEndDate(today, 100));
  const [selectedTaskId, setSelectedTaskId] = useState<UUID | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskSelectionTouched, setTaskSelectionTouched] = useState(false);

  const { t } = useTranslation();
  const toast = useToast();
  const isEditMode = !!habitToEdit;
  const taskFilterStatus = useMemo(() => ACTIVE_TASK_STATUSES, []);

  const weekdayOptions = useMemo(
    () =>
      WEEKDAY_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const cadenceOptions = useMemo(
    () => [
      { value: "daily", label: t("habitForm.cadence.daily") },
      { value: "weekly", label: t("habitForm.cadence.weekly") },
      { value: "monthly", label: t("habitForm.cadence.monthly") },
      { value: "yearly", label: t("habitForm.cadence.yearly") },
    ],
    [t],
  );

  useEffect(() => {
    setTaskSelectionTouched(false);
    if (habitToEdit) {
      const nextFrequency =
        (habitToEdit.cadence_frequency as HabitCadenceFrequency | null) ??
        "daily";
      setTitle(habitToEdit.title);
      setDescription(habitToEdit.description || "");
      setStartDate(habitToEdit.start_date);
      setCadenceFrequency(nextFrequency);
      setCadenceWeekdays(habitToEdit.cadence_weekdays ?? []);
      setCadenceMonthdaysText((habitToEdit.cadence_monthdays ?? []).join(","));
      setTargetPerCycle(habitToEdit.target_per_cycle ?? 1);
      setRepeatCount(habitToEdit.duration_days);
      setEndDate(getHabitEndDate(habitToEdit.start_date, habitToEdit.duration_days));
      setEndMode(nextFrequency === "daily" ? "repeat_count" : "until_date");
      setSelectedTaskId(habitToEdit.task_id || null);
      setStatus(habitToEdit.status);
      return;
    }

    if (prefillHabit) {
      const nextToday = getTodayDateString();
      setTitle(prefillHabit.title);
      setDescription(prefillHabit.description || "");
      setStartDate(nextToday);
      setCadenceFrequency("daily");
      setCadenceWeekdays([]);
      setCadenceMonthdaysText("");
      setTargetPerCycle(1);
      setEndMode("repeat_count");
      setRepeatCount(prefillHabit.duration_days);
      setEndDate(getHabitEndDate(nextToday, prefillHabit.duration_days));
      setSelectedTaskId(prefillHabit.task_id || null);
      setStatus("active");
      return;
    }

    const nextToday = getTodayDateString();
    setTitle("");
    setDescription("");
    setStartDate(nextToday);
    setCadenceFrequency("daily");
    setCadenceWeekdays([]);
    setCadenceMonthdaysText("");
    setTargetPerCycle(1);
    setEndMode("repeat_count");
    setRepeatCount(100);
    setEndDate(getHabitEndDate(nextToday, 100));
    setSelectedTaskId(null);
    setStatus("active");
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

    const normalizedRepeatCount = Math.floor(Number(repeatCount));
    if (endMode === "repeat_count" && normalizedRepeatCount <= 0) {
      setError(t("habitForm.validation.repeatCountRequired"));
      return;
    }

    if (endMode === "until_date") {
      if (!endDate) {
        setError(t("habitForm.validation.endDateRequired"));
        return;
      }
      if (endDate < startDate) {
        setError(t("habitForm.validation.endDateAfterStart"));
        return;
      }
    }

    const parsedMonthdays =
      cadenceFrequency === "monthly" ? parseMonthdays(cadenceMonthdaysText) : null;
    if (Array.isArray(parsedMonthdays) && parsedMonthdays.length === 0) {
      setError(t("habitForm.validation.monthdaysInvalid"));
      return;
    }

    const normalizedTarget = Math.max(1, Math.floor(Number(targetPerCycle) || 1));
    const cadenceFields = {
      cadence_frequency: cadenceFrequency,
      cadence_weekdays: cadenceFrequency === "weekly" ? cadenceWeekdays : null,
      cadence_monthdays: cadenceFrequency === "monthly" ? parsedMonthdays : null,
      target_per_cycle: cadenceFrequency === "daily" ? 1 : normalizedTarget,
    };
    const endFields =
      endMode === "repeat_count"
        ? { repeat_count: normalizedRepeatCount, end_date: null }
        : { end_date: endDate, repeat_count: null };

    setLoading(true);
    setError(null);

    try {
      if (isEditMode && habitToEdit && onUpdateHabit) {
        const shouldSendTaskId = !isEditMode || taskSelectionTouched;
        const nextTaskId = selectedTaskId ?? null;
        const updateData: HabitUpdate = {
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startDate,
          status,
          ...cadenceFields,
          ...endFields,
        };
        if (shouldSendTaskId) {
          updateData.task_id = nextTaskId;
        }

        await onUpdateHabit(habitToEdit.id, updateData);
        toast.showSuccess(t("habitForm.messages.updateSuccess"));
      } else if (!isEditMode && onCreateHabit) {
        const nextTaskId = selectedTaskId ?? null;
        const habitData: HabitCreate = {
          title: title.trim(),
          description: description.trim() || undefined,
          start_date: startDate,
          task_id: nextTaskId,
          ...cadenceFields,
          ...endFields,
        };

        await onCreateHabit(habitData);
        toast.showSuccess(t("habitForm.messages.createSuccess"));
      } else {
        throw new Error("Missing required mutation functions");
      }

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
      const nextToday = getTodayDateString();
      setTitle("");
      setDescription("");
      setStartDate(nextToday);
      setCadenceFrequency("daily");
      setCadenceWeekdays([]);
      setCadenceMonthdaysText("");
      setTargetPerCycle(1);
      setEndMode("repeat_count");
      setRepeatCount(100);
      setEndDate(getHabitEndDate(nextToday, 100));
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
            className="text-sm"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <EnumSelect
              id="habit-form-cadence-frequency"
              value={cadenceFrequency}
              onChange={(value) => {
                const nextFrequency = (value || "daily") as HabitCadenceFrequency;
                setCadenceFrequency(nextFrequency);
                if (nextFrequency === "daily") {
                  setTargetPerCycle(1);
                }
              }}
              disabled={loading}
              options={cadenceOptions}
              label={`${t("habitForm.fields.cadenceFrequency")} *`}
            />
          </div>

          <FormField
            label={t("habitForm.fields.targetPerCycle")}
            htmlFor="targetPerCycle"
            required={cadenceFrequency !== "daily"}
          >
            <TextInput
              id="targetPerCycle"
              name="targetPerCycle"
              type="number"
              min={1}
              value={String(cadenceFrequency === "daily" ? 1 : targetPerCycle)}
              onChange={(e) => setTargetPerCycle(Number(e.target.value) || 1)}
              disabled={loading || cadenceFrequency === "daily"}
              required={cadenceFrequency !== "daily"}
            />
          </FormField>
        </div>

        {cadenceFrequency === "weekly" && (
          <CheckboxGroup
            idPrefix="habit-form-weekdays"
            name="habit-weekdays"
            value={cadenceWeekdays}
            options={weekdayOptions}
            onChange={setCadenceWeekdays}
            disabled={loading}
            label={t("habitForm.fields.weekdays")}
            direction="horizontal"
            columns={4}
            size="sm"
          />
        )}

        {cadenceFrequency === "monthly" && (
          <FormField
            label={t("habitForm.fields.monthdays")}
            htmlFor="monthdays"
            description={t("habitForm.fields.monthdaysHint")}
          >
            <TextInput
              id="monthdays"
              name="monthdays"
              type="text"
              inputMode="numeric"
              value={cadenceMonthdaysText}
              onChange={(e) => setCadenceMonthdaysText(e.target.value)}
              placeholder={t("habitForm.fields.monthdaysPlaceholder")}
              disabled={loading}
            />
          </FormField>
        )}

        <SegmentedControl
          name="habit-end-mode"
          label={t("habitForm.fields.endMode")}
          value={endMode}
          onChange={(value) => setEndMode(value as HabitEndMode)}
          disabled={loading}
          options={[
            {
              value: "repeat_count",
              label: t("habitForm.endMode.repeatCount"),
            },
            {
              value: "until_date",
              label: t("habitForm.endMode.untilDate"),
            },
          ]}
          size="sm"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {endMode === "repeat_count" ? (
            <FormField
              label={t("habitForm.fields.repeatCount")}
              htmlFor="repeatCount"
              required
            >
              <TextInput
                id="repeatCount"
                name="repeatCount"
                type="number"
                min={1}
                value={String(repeatCount)}
                onChange={(e) => setRepeatCount(Number(e.target.value) || 1)}
                disabled={loading}
                required
              />
            </FormField>
          ) : (
            <FormField
              label={t("habitForm.fields.endDate")}
              htmlFor="endDate"
              required
            >
              <TextInput
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
                required
              />
            </FormField>
          )}

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
