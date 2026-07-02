import React, { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import ModalBase from "@/layouts/ModalBase";
import LoadingSpinner from "./LoadingSpinner";
import EmptyState from "./EmptyState";
import ActionButton from "./ActionButton";
import { Icon } from "./icons";
import {
  formatDate,
  formatDateTime,
  formatDurationFromTimes,
  formatTime,
  resolvePreferredTimezone,
} from "@/utils/datetime";
import type { PersonSummary } from "@/services/api";
import type {
  PersonActivityItem,
  PersonActivityType,
} from "@/services/api/persons";
import { useAreas } from "@/hooks/queries/useAreas";
import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";
import AreaBadge from "./AreaBadge";

interface PersonTimelineModalProps {
  person: PersonSummary | null;
  isOpen: boolean;
  onClose: () => void;
  activities: PersonActivityItem[];
  total: number;
  totalPages: number;
  isLoadingActivities: boolean;
  isFetchingActivities: boolean;
  page: number;
  onPageChange: (page: number) => void;
  activityType: "all" | PersonActivityType;
  onActivityTypeChange: (value: "all" | PersonActivityType) => void;
}

/**
 * PersonTimelineModal - Modal component for displaying person activity timeline
 *
 * This component provides a modal interface for:
 * - Displaying person activity timeline
 * - Showing activity details with status and type
 * - Handling loading and empty states
 */
const PersonTimelineModal: React.FC<PersonTimelineModalProps> = ({
  person,
  isOpen,
  onClose,
  activities,
  total,
  totalPages,
  isLoadingActivities,
  isFetchingActivities,
  page,
  onPageChange,
  activityType,
  onActivityTypeChange,
}) => {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const timezonePreference = usePreferenceWithBootstrap<string>({
    key: "system.timezone",
    defaultValue: resolvePreferredTimezone(),
    module: "system",
    validator: (value) => typeof value === "string" && value.length > 0,
  });
  const activeTimezone = resolvePreferredTimezone(timezonePreference.value);
  const { areaMap } = useAreas();

  // Virtualize the timeline with dynamic row-height measurement.
  const virtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index: number) => {
      // Estimate height from content shape.
      const activity = activities[index];
      if (!activity) return 60;

      // Base height: time, module, title, and padding.
      let baseHeight = 100;

      // Add room for descriptions by estimating wrapped line count.
      if (activity.description) {
        const descriptionLength = activity.description.length;
        const containerWidth = 1000;
        const charWidth = 14;
        const charsPerLine = Math.floor(containerWidth / charWidth);
        const estimatedLines = Math.ceil(descriptionLength / charsPerLine);
        baseHeight += estimatedLines * 22 + 20;
      }

      return Math.max(baseHeight, 100);
    },
    overscan: 5,
    measureElement: (element: Element | null) => {
      return element?.getBoundingClientRect().height ?? 60;
    },
  });

  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [page, activityType]);

  const activityTypeMeta = useMemo(
    () => ({
      vision: {
        label: t("persons.activityTypes.vision"),
        badgeClass: "text-secondary bg-secondary/10",
        icon: "star" as const,
      },
      task: {
        label: t("persons.activityTypes.task"),
        badgeClass: "text-primary bg-primary/10",
        icon: "clipboard" as const,
      },
      planned_event: {
        label: t("persons.activityTypes.planned_event"),
        badgeClass: "text-info bg-info/10",
        icon: "calendar" as const,
      },
      timelog: {
        label: t("persons.activityTypes.timelog"),
        badgeClass: "text-warning bg-warning/20",
        icon: "timer" as const,
      },
      note: {
        label: t("persons.activityTypes.note"),
        badgeClass: "text-base-content bg-base-200/80",
        icon: "document-text" as const,
      },
    }),
    [t],
  );

  const filterOptions = useMemo(
    () => [
      { value: "all" as const, label: t("common.all") },
      { value: "note" as const, label: activityTypeMeta.note.label },
      { value: "task" as const, label: activityTypeMeta.task.label },
      {
        value: "planned_event" as const,
        label: activityTypeMeta.planned_event.label,
      },
      {
        value: "timelog" as const,
        label: activityTypeMeta.timelog.label,
      },
      { value: "vision" as const, label: activityTypeMeta.vision.label },
    ],
    [activityTypeMeta, t],
  );

  const getActivityTypeMeta = (type: string) =>
    activityTypeMeta[type as keyof typeof activityTypeMeta] ??
    activityTypeMeta.note;

  const safeTotalPages = Math.max(1, totalPages);
  const canGoPrev = page > 1;
  const canGoNext = page < safeTotalPages;

  useEffect(() => {
    if (page > safeTotalPages) {
      onPageChange(safeTotalPages);
    }
  }, [page, safeTotalPages, onPageChange]);

  // Get activity status display
  const getStatusDisplay = (status: string | null) => {
    if (!status) return null;

    const statusMap = {
      todo: t("status.todo"),
      in_progress: t("status.in_progress"),
      done: t("status.done"),
      cancelled: t("status.cancelled"),
      active: t("status.active"),
      archived: t("status.archived"),
      fruit: t("status.fruit"),
      planned: t("persons.activityStatus.planned"),
      completed: t("status.completed"),
    };

    return statusMap[status as keyof typeof statusMap] || status;
  };

  // Get status color
  const getStatusColor = (status: string | null) => {
    if (!status) return "bg-base-200 text-base-content/70";

    const colorMap = {
      todo: "bg-base-200 text-base-content/70",
      in_progress: "bg-error/20 text-error",
      done: "bg-success/20 text-success",
      cancelled: "bg-base-200 text-base-content/70",
      paused: "bg-warning/20 text-warning",
      active: "bg-success/20 text-success",
      archived: "bg-base-200 text-base-content/70",
      fruit: "bg-secondary/20 text-secondary",
      planned: "bg-info/20 text-info",
      completed: "bg-success/20 text-success",
    };

    return (
      colorMap[status as keyof typeof colorMap] ||
      "bg-base-200 text-base-content/70"
    );
  };

  const renderTimelogDetails = (activity: PersonActivityItem) => {
    const startTime = activity.start_time ?? activity.date;
    const endTime = activity.end_time ?? null;
    const timeRange = `${formatTime(startTime, activeTimezone)}${
      endTime ? `-${formatTime(endTime, activeTimezone)}` : ""
    }`;
    const duration = formatDurationFromTimes(startTime, endTime);
    const areaName =
      (activity.area_id ? areaMap.get(activity.area_id)?.name : null) ??
      t("taskTimelogs.unknownArea");
    return (
      <div className="grid grid-cols-[minmax(100px,0.8fr)_minmax(70px,0.6fr)_minmax(120px,0.8fr)_minmax(180px,2fr)] gap-3 text-sm leading-relaxed">
        <div className="text-base-content/80">{timeRange}</div>
        <div className="text-base-content/80">{duration}</div>
        <div className="min-w-0">
          <AreaBadge
            areaId={activity.area_id ?? undefined}
            areaMap={areaMap}
            name={areaName}
            showLabel
            size="sm"
            labelClassName="text-sm"
            ariaLabel={areaName}
          />
        </div>
        <div className="min-w-0 truncate text-base-content/90" title={activity.title}>
          {activity.title}
        </div>
      </div>
    );
  };

  if (!isOpen || !person) return null;

  const titleContent = (
    <>
      {t("persons.timeline.title", {
        name: person.display_name,
      })}
      {t("persons.timeline.activityCount", {
        count: total,
      })}
    </>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="person-timeline-title"
      size="2xl"
      loading={isLoadingActivities}
      showLoadingOverlay={false}
      showLoadingSpinner={true}
      loadingSpinnerSize="md"
      showCloseButton={true}
      title={titleContent}
    >
      {isLoadingActivities ? (
        <LoadingSpinner message={t("persons.timeline.loadingActivities")} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {filterOptions.map((option) => {
              const isActive = activityType === option.value;
              return (
                <ActionButton
                  key={option.value}
                  label={option.label}
                  size="sm"
                  color={isActive ? "primary" : "neutral"}
                  variant={isActive ? "solid" : "ghost"}
                  onClick={() => {
                    onActivityTypeChange(option.value);
                    if (page !== 1) {
                      onPageChange(1);
                    }
                  }}
                />
              );
            })}
          </div>
          {activities.length > 0 ? (
            <>
              <div ref={parentRef} className="h-[48rem] overflow-auto">
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer
                    .getVirtualItems()
                    .map((virtualItem: VirtualItem) => {
                      const activity = activities[virtualItem.index];
                      if (!activity) return null;
                      const typeMeta = getActivityTypeMeta(activity.type);
                      const isTimelog = activity.type === "timelog";
                      return (
                        <div
                          key={`${activity.type}-${activity.id}`}
                          ref={virtualizer.measureElement}
                          data-index={virtualItem.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                          className="py-3 px-4 border-b border-base-200"
                        >
                          {/* First line: Time, Module, Title */}
                          <div className="flex items-start space-x-4">
                            {/* Time */}
                            <div className="flex-shrink-0 text-sm font-mono min-w-[110px] text-base-content/80">
                              {isTimelog
                                ? formatDate(
                                    activity.start_time ?? activity.date,
                                    activeTimezone,
                                  )
                                : formatDateTime(activity.date, activeTimezone)}
                            </div>

                            {/* Module */}
                            <div className="flex-shrink-0 flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded ${typeMeta.badgeClass}`}
                              >
                                <Icon
                                  name={typeMeta.icon}
                                  size={14}
                                  className="text-current"
                                  aria-hidden
                                />
                                {typeMeta.label}
                              </span>
                              {activity.status && !isTimelog && (
                                <span
                                  className={`inline-flex items-center px-2 py-1 text-sm rounded ${getStatusColor(activity.status)}`}
                                >
                                  {getStatusDisplay(activity.status)}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <div className="flex-1 min-w-0">
                              {isTimelog ? (
                                renderTimelogDetails(activity)
                              ) : (
                                <h4 className="text-base font-medium break-words leading-relaxed">
                                  {activity.title}
                                </h4>
                              )}
                            </div>
                          </div>

                          {/* Description line (if exists) - aligned to record start */}
                          {activity.description && !isTimelog && (
                            <div className="flex mt-2">
                              <div className="flex-shrink-0 min-w-[110px]"></div>
                              <div className="flex-shrink-0 min-w-[140px]"></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-base-content/90 break-words leading-relaxed">
                                  {activity.description}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pt-3">
                <ActionButton
                  label={t("persons.timeline.previousPage")}
                  size="sm"
                  variant="outline"
                  color="neutral"
                  disabled={!canGoPrev}
                  onClick={() => onPageChange(page - 1)}
                />
                <div className="flex items-center gap-3 text-sm text-base-content/70">
                  <span>
                    {t("persons.timeline.pageIndicator", {
                      page,
                      total: safeTotalPages,
                    })}
                  </span>
                  {isFetchingActivities && (
                    <span className="text-xs text-base-content/60">
                      {t("common.loading")}
                    </span>
                  )}
                </div>
                <ActionButton
                  label={t("persons.timeline.nextPage")}
                  size="sm"
                  variant="outline"
                  color="neutral"
                  disabled={!canGoNext}
                  onClick={() => onPageChange(page + 1)}
                />
              </div>
            </>
          ) : (
            <div className="px-4 pb-4">
              <EmptyState
                icon={<Icon name="document-text" size={48} aria-hidden />}
                title={t("persons.timeline.noActivities")}
                description={t("persons.timeline.noActivitiesDescription")}
              />
            </div>
          )}
        </>
      )}
    </ModalBase>
  );
};

export default PersonTimelineModal;
