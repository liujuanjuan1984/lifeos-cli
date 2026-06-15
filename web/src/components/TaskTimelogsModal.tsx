import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Timelog, TaskWithSubtasks } from "@/services/api";
import type { UUID } from "@/types/primitive";
import { formatDate, resolvePreferredTimezone } from "@/utils/datetime";
import TimeRangeText from "./TimeRangeText";
import ModalBase from "@/layouts/ModalBase";
import { useTaskTimelogs } from "@/hooks/queries/useTaskTimelogs";
import ListContainer from "@/layouts/ListContainer";
import DimensionBadge from "./DimensionBadge";
import { Icon } from "./icons";
import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";

interface TaskTimelogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskWithSubtasks | null;
}

/**
 * TaskTimelogsModal - Independent modal for displaying time records associated with a task
 *
 * This modal shows all timelogs (timelog records) that are associated
 * with a specific task, ordered by time (newest first).
 */
const TaskTimelogsModal: React.FC<TaskTimelogsModalProps> = ({
  isOpen,
  onClose,
  task,
}) => {
  const { t } = useTranslation();
  const timezonePreference = usePreferenceWithBootstrap<string>({
    key: "system.timezone",
    defaultValue: resolvePreferredTimezone(),
    module: "system",
    validator: (value) => typeof value === "string" && value.length > 0,
  });
  const activeTimezone = resolvePreferredTimezone(timezonePreference.value);

  // 使用 TanStack Query 替代手动状态管理
  const {
    data: timelogsData,
    isLoading,
    error,
    refetch,
  } = useTaskTimelogs(task?.id || ("" as UUID), {
    enabled: !!task?.id && isOpen,
  });
  const timelogs = useMemo(
    () => timelogsData ?? [],
    [timelogsData],
  );

  // Calculate duration for an event
  const calculateDuration = (event: Timelog): string => {
    if (!event.start_time || !event.end_time) {
      return t("taskTimelogs.duration");
    }

    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    if (durationMinutes < 60) {
      return `${durationMinutes}${t("taskTimelogs.minutes")}`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0
        ? `${hours}${t("taskTimelogs.hours")}${minutes}${t("taskTimelogs.minutes")}`
        : `${hours}${t("taskTimelogs.hours")}`;
    }
  };

  // Replaced by TimeRangeText

  // Calculate total time spent on this task
  const calculateTotalTime = (): string => {
    let totalMinutes = 0;
    timelogs.forEach((event) => {
      if (event.start_time && event.end_time) {
        const startTime = new Date(event.start_time);
        const endTime = new Date(event.end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        totalMinutes += Math.round(durationMs / (1000 * 60));
      }
    });

    if (totalMinutes < 60) {
      return `${totalMinutes}${t("taskTimelogs.minutes")}`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0
        ? `${hours}${t("taskTimelogs.hours")}${minutes}${t("taskTimelogs.minutes")}`
        : `${hours}${t("taskTimelogs.hours")}`;
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      header={t("taskTimelogs.title")}
      size="2xl"
      loading={isLoading}
      error={error?.message}
      onErrorDismiss={() => refetch()}
      showLoadingSpinner={true}
      loadingSpinnerSize="md"
      showCloseButton={true}
      errorDisplayMode="inline"
    >
      {!isLoading && !error && (
        <div className="px-2 pt-4 pb-2 flex items-center justify-between">
          <div className="text-base">
            {task && (
              <span>
                {t("taskTimelogs.taskLabel")} {task.content}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-base-content/40">
              {t("taskTimelogs.totalTime")} {calculateTotalTime()}
            </div>
            <div className="text-sm text-base-content/40">
              {t("taskTimelogs.recordsCount", {
                count: timelogs.length,
              })}
            </div>
          </div>
        </div>
      )}

      <ListContainer
        title={t("taskTimelogs.title")}
        hideHeader
        size="lg"
        borderVariant="subtle"
        columns={[
          {
            key: "date",
            label: t("taskTimelogs.columns.date"),
            width: "0.5fr",
            align: "left",
          },
          {
            key: "timeRange",
            label: t("taskTimelogs.columns.timeRange"),
            width: "0.7fr",
            align: "left",
          },
          {
            key: "duration",
            label: t("taskTimelogs.columns.duration"),
            width: "0.5fr",
            align: "left",
          },
          {
            key: "dimension",
            label: t("taskTimelogs.columns.dimension"),
            width: "0.5fr",
            align: "left",
          },
          {
            key: "description",
            label: t("taskTimelogs.columns.description"),
            width: "2.5fr",
            align: "left",
          },
        ]}
        emptyState={
          !isLoading && !error && timelogs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center max-w-md">
                <Icon
                  name="timer"
                  size={48}
                  className="mb-6 opacity-60 text-info"
                  aria-hidden
                />
                <h3 className="text-lg font-semibold text-base-content mb-3">
                  {t("taskTimelogs.emptyState.title")}
                </h3>
                <p className="text-base-content/80 mb-4 leading-relaxed">
                  {t("taskTimelogs.emptyState.description")}
                </p>
              </div>
            </div>
          ) : null
        }
      >
        {!isLoading && !error && timelogs.length > 0 && (
          <div className="px-2 py-3 overflow-x-auto">
            <div
              className="min-w-[760px] grid gap-4"
              style={{
                gridTemplateColumns: [
                  "0.5fr",
                  "0.7fr",
                  "0.5fr",
                  "0.5fr",
                  "2.5fr",
                ].join(" "),
              }}
            >
              {timelogs.map((event) => {
                const trimmedTitle = event.title.trim();
                const description =
                  trimmedTitle.length > 0
                    ? trimmedTitle
                    : t("taskTimelogs.untitled");
                const dimensionName =
                  event.dimension_summary?.name ||
                  t("taskTimelogs.unknownDimension");

                return (
                  <React.Fragment key={event.id}>
                    <div className="text-base-content/80 flex items-center">
                      {formatDate(event.start_time, activeTimezone)}
                    </div>
                    <div className="text-base-content/90 flex items-center gap-2">
                      <Icon
                        name="timer"
                        size={16}
                        className="text-primary/70"
                        aria-hidden
                      />
                      <TimeRangeText
                        start={event.start_time}
                        end={event.end_time || null}
                        timezone={activeTimezone}
                      />
                    </div>
                    <div className="text-left text-base-content/90 flex items-center gap-2">
                      {calculateDuration(event)}
                    </div>
                    <div className="flex items-center">
                      <DimensionBadge
                        name={dimensionName}
                        color={event.dimension_summary?.color || undefined}
                        showLabel
                        className="text-sm"
                        ariaLabel={dimensionName}
                      />
                    </div>
                    <div
                      className="text-base-content/90 flex items-center truncate"
                      title={description}
                    >
                      {description}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </ListContainer>
    </ModalBase>
  );
};

export default TaskTimelogsModal;
