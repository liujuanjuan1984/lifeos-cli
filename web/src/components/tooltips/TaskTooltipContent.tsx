import React from "react";
import { useTranslation } from "react-i18next";
import { formatDate, formatDateTime, formatDuration } from "@/utils/datetime";
import { PRIORITY, TASK_STATUS_LABELS } from "@/utils/constants";

interface TaskTooltipContentProps {
  task: {
    content: string;
    status?: string | null;
    priority?: number | null;
    planning_cycle_type?: string | null;
    planning_cycle_start_date?: string | null;
    actual_effort_total?: number | null;
    actual_effort_self?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
    vision_summary?: {
      name: string;
    } | null;
    parent_summary?: {
      content: string;
    } | null;
  };
  visionName?: string | null;
  parentTaskName?: string | null;
}

const TaskTooltipContent: React.FC<TaskTooltipContentProps> = ({
  task,
  visionName,
  parentTaskName,
}) => {
  const { t } = useTranslation();
  const noneLabel = t("draggableTaskList.tooltip.none");

  const resolvedVisionName =
    visionName ?? task.vision_summary?.name ?? noneLabel;
  const resolvedParentName =
    parentTaskName ?? task.parent_summary?.content ?? noneLabel;

  const priorityIndex = Number.isFinite(task.priority)
    ? Math.max(0, Math.min(PRIORITY.length - 1, Number(task.priority ?? 0)))
    : 0;
  const priorityInfo = PRIORITY[priorityIndex] ?? PRIORITY[0];
  const priorityLabel =
    priorityInfo.label ??
    (Number.isFinite(task.priority) ? String(task.priority) : noneLabel);

  const statusLabel =
    (task.status &&
      TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]) ||
    task.status ||
    noneLabel;

  const planningCycleValue = (() => {
    if (!task.planning_cycle_type) {
      return null;
    }
    const cycleTypeMap: Record<string, string> = {
      day: t("draggableTaskList.planningCycle.day"),
      week: t("draggableTaskList.planningCycle.week"),
      month: t("draggableTaskList.planningCycle.month"),
      year: t("draggableTaskList.planningCycle.year"),
      "7years": t("draggableTaskList.planningCycle.7years"),
    };
    const periodText =
      cycleTypeMap[task.planning_cycle_type] || task.planning_cycle_type;
    if (task.planning_cycle_start_date) {
      const formattedStart = formatDate(task.planning_cycle_start_date);
      return t("draggableTaskList.tooltip.planningCycleValueWithDate", {
        period: periodText,
        date: formattedStart,
      });
    }
    return periodText;
  })();

  const totalEffort = formatDuration(task.actual_effort_total ?? 0);
  const selfEffort = formatDuration(task.actual_effort_self ?? 0);
  const createdAt = task.created_at ? formatDateTime(task.created_at) : null;
  const updatedAt = task.updated_at ? formatDateTime(task.updated_at) : null;

  return (
    <div>
      <div className="font-semibold mb-2 text-base-content">
        {t("draggableTaskList.tooltip.title", { name: task.content })}
      </div>
      <ul className="space-y-1 text-base-content/80 text-sm">
        <li>
          {t("draggableTaskList.tooltip.vision", {
            vision: resolvedVisionName,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.parent", {
            parent: resolvedParentName,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.priority", {
            priority: priorityLabel,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.status", {
            status: statusLabel,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.planningCycle", {
            planning: planningCycleValue ?? noneLabel,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.totalEffort", {
            duration: totalEffort,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.selfEffort", {
            duration: selfEffort,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.createdAt", {
            date: createdAt ?? noneLabel,
          })}
        </li>
        <li>
          {t("draggableTaskList.tooltip.updatedAt", {
            date: updatedAt ?? noneLabel,
          })}
        </li>
      </ul>
    </div>
  );
};

export default TaskTooltipContent;
