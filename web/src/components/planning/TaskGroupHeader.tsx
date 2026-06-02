import React from "react";
import { useTranslation } from "react-i18next";
import Container from "@/layouts/Container";
import ActionButton from "@/components/ActionButton";
import EnumSelect from "@/components/selects/EnumSelect";
import { Icon } from "@/components/icons";

import type { StatusFilterOption } from "@/hooks/planning/usePlanningTaskGroup";

interface TaskGroupHeaderProps {
  groupId: string;
  groupLabel: string;
  periodRangeLabel?: string;
  planningCycleType?: "year" | "month" | "week" | "day";
  totalTimeSpent: string;
  statusFilter: string;
  statusFilterOptions: StatusFilterOption[];
  onStatusFilterChange: (value: string) => void;
  visionFilter: string;
  visionFilterOptions: StatusFilterOption[];
  onVisionFilterChange: (value: string) => void;
  canCreateTask: boolean;
  canAddTask: boolean;
  isCreatingTask: boolean;
  isAddingTask: boolean;
  isExporting: boolean;
  isCarryingForward: boolean;
  carryForwardCount: number;
  onCreateTaskClick: () => void;
  onAddTaskClick: () => void;
  onExportClick: () => void;
  onCarryForwardClick: () => void;
}

const LoadingDot: React.FC<{ className: string }> = ({ className }) => (
  <div
    className={`animate-spin rounded-full h-4 w-4 border-b-2 ${className}`}
  />
);

export const TaskGroupHeader: React.FC<TaskGroupHeaderProps> = ({
  groupId,
  groupLabel,
  periodRangeLabel,
  planningCycleType,
  totalTimeSpent,
  statusFilter,
  statusFilterOptions,
  onStatusFilterChange,
  visionFilter,
  visionFilterOptions,
  onVisionFilterChange,
  canCreateTask,
  canAddTask,
  isCreatingTask,
  isAddingTask,
  isExporting,
  isCarryingForward,
  carryForwardCount,
  onCreateTaskClick,
  onAddTaskClick,
  onExportClick,
  onCarryForwardClick,
}) => {
  const { t } = useTranslation();

  return (
    <Container
      className="mb-2 w-full max-w-full"
      overflow="hidden"
      maxHeight="fit"
      padding="responsive"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-base-content">{groupLabel}</h3>
          {planningCycleType !== "day" && periodRangeLabel && (
            <p className="text-sm text-base-content opacity-70">
              {periodRangeLabel}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 text-sm text-base-content opacity-70">
            <Icon name="timer" size={16} aria-hidden />
            <span>{totalTimeSpent}</span>
          </div>

          <div
            className="flex items-center gap-2 flex-wrap"
            onClick={(event) => event.stopPropagation()}
          >
            <EnumSelect
              id={`status-filter-${groupId}`}
              value={statusFilter}
              onChange={(value) => {
                if (value) {
                  onStatusFilterChange(value as string);
                }
              }}
              options={statusFilterOptions}
              className="text-sm sm:text-base min-w-28 max-w-48"
              autoWidth
            />
            <EnumSelect
              id={`vision-filter-${groupId}`}
              value={visionFilter}
              onChange={(value) => {
                if (value) {
                  onVisionFilterChange(value as string);
                }
              }}
              options={visionFilterOptions}
              placeholder={t("planning.filters.vision.label")}
              className="text-sm sm:text-base min-w-36 max-w-72"
              autoWidth
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {canCreateTask && (
            <ActionButton
              label=""
              icon={
                isCreatingTask ? (
                  <LoadingDot className="border-success" />
                ) : undefined
              }
              iconName={isCreatingTask ? undefined : "plus"}
              color="success"
              variant="ghost"
              size="sm"
              onClick={onCreateTaskClick}
              disabled={isCreatingTask}
              iconOnly
            />
          )}

          {canAddTask && (
            <ActionButton
              label={t("planning.taskActions.addTask", { period: groupLabel })}
              icon={
                isAddingTask ? (
                  <LoadingDot className="border-primary" />
                ) : (
                  <Icon name="link" size={16} aria-hidden />
                )
              }
              color="primary"
              variant="ghost"
              size="sm"
              onClick={onAddTaskClick}
              disabled={isAddingTask}
              iconOnly
              ariaLabel={t("planning.taskActions.addTask", {
                period: groupLabel,
              })}
            />
          )}

          {canAddTask && (
            <ActionButton
              label={t("planning.taskActions.export")}
              icon={
                isExporting ? (
                  <LoadingDot className="border-secondary" />
                ) : (
                  <Icon name="clipboard" size={16} aria-hidden />
                )
              }
              color="primary"
              variant="ghost"
              size="sm"
              onClick={onExportClick}
              disabled={isExporting}
              iconOnly
              ariaLabel={t("planning.taskActions.export")}
            />
          )}

          {canAddTask && (
            <ActionButton
              label={t("planning.taskActions.carryForward", {
                count: carryForwardCount,
              })}
              icon={
                isCarryingForward ? (
                  <LoadingDot className="border-warning" />
                ) : (
                  <Icon name="forward" size={16} aria-hidden />
                )
              }
              color="warning"
              variant="ghost"
              size="sm"
              onClick={onCarryForwardClick}
              disabled={isCarryingForward || carryForwardCount === 0}
            />
          )}
        </div>
      </div>
    </Container>
  );
};
