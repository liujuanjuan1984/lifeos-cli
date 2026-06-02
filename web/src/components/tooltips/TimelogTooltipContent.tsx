import React from "react";
import { useTranslation } from "react-i18next";
import DimensionBadge from "@/components/DimensionBadge";
import { formatDurationFromTimes, formatTime } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";

interface TimelogTooltipContentProps {
  entry: {
    title?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    dimension_id?: UUID | null;
    dimension_summary?: {
      name?: string | null;
      color?: string | null;
    } | null;
    task_summary?: {
      content?: string | null;
      status?: string | null;
      vision_summary?: {
        name?: string | null;
      } | null;
    } | null;
  };
  dimensionMap: Map<UUID, { name: string; color: string }>;
}

const TimelogTooltipContent: React.FC<TimelogTooltipContentProps> = ({
  entry,
  dimensionMap,
}) => {
  const { t } = useTranslation();

  const startLabel = entry.start_time
    ? formatTime(entry.start_time)
    : t("common.placeholder");
  const endLabel = entry.end_time
    ? formatTime(entry.end_time)
    : t("common.placeholder");
  const timeRange = `${startLabel} - ${endLabel}`;
  const durationLabel = formatDurationFromTimes(
    entry.start_time ?? null,
    entry.end_time ?? null,
  );

  const dimensionSummary = entry.dimension_summary ?? undefined;
  const dimensionId = entry.dimension_id ?? undefined;
  const dimensionMapEntry =
    dimensionId && typeof dimensionId === "string"
      ? dimensionMap.get(dimensionId as UUID)
      : undefined;
  const dimensionName =
    dimensionSummary?.name ??
    dimensionMapEntry?.name ??
    (entry.dimension_id
      ? t("timeLog.progressBar.unknownDimension")
      : t("common.none"));
  const dimensionColor =
    dimensionSummary?.color ?? dimensionMapEntry?.color ?? undefined;

  const visionName =
    entry.task_summary?.vision_summary?.name ?? t("common.none");
  const taskContent = entry.task_summary?.content ?? t("common.none");
  const statusKey = entry.task_summary?.status;
  const statusLabel = statusKey
    ? (() => {
        const key = `status.${statusKey}`;
        const translated = t(key);
        return translated === key ? statusKey : translated;
      })()
    : t("common.none");

  return (
    <div className="space-y-2">
      <div className="text-base font-semibold text-base-content">
        {entry.title || t("common.placeholder")}
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("timeLog.tooltip.timeRange")}:
          </dt>
          <dd className="text-base-content">{timeRange}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("timeLog.tooltip.duration")}:
          </dt>
          <dd className="text-base-content">{durationLabel}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("timeLog.tooltip.dimension")}:
          </dt>
          <dd className="text-base-content">
            <DimensionBadge
              dimensionId={dimensionId}
              dimensionMap={dimensionMap}
              name={dimensionName}
              color={dimensionColor ?? undefined}
              showLabel
            />
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("timeLog.tooltip.vision")}:
          </dt>
          <dd className="text-base-content">{visionName}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("timeLog.tooltip.task")}:
          </dt>
          <dd className="text-base-content">{taskContent}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="font-medium text-base-content/70">
            {t("timeLog.tooltip.status")}:
          </dt>
          <dd className="text-base-content">{statusLabel}</dd>
        </div>
      </dl>
    </div>
  );
};

export default TimelogTooltipContent;
