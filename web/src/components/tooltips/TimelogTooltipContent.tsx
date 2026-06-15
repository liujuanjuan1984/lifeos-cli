import React from "react";
import { useTranslation } from "react-i18next";
import AreaBadge from "@/components/AreaBadge";
import { formatDurationFromTimes, formatTime } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";

interface TimelogTooltipContentProps {
  entry: {
    title?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    area_id?: UUID | null;
    area_summary?: {
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
  areaMap: Map<UUID, { name: string; color: string }>;
  timezone?: string;
}

const TimelogTooltipContent: React.FC<TimelogTooltipContentProps> = ({
  entry,
  areaMap,
  timezone,
}) => {
  const { t } = useTranslation();

  const startLabel = entry.start_time
    ? formatTime(entry.start_time, timezone)
    : t("common.placeholder");
  const endLabel = entry.end_time
    ? formatTime(entry.end_time, timezone)
    : t("common.placeholder");
  const timeRange = `${startLabel} - ${endLabel}`;
  const durationLabel = formatDurationFromTimes(
    entry.start_time ?? null,
    entry.end_time ?? null,
  );

  const areaSummary = entry.area_summary ?? undefined;
  const areaId = entry.area_id ?? undefined;
  const areaMapEntry =
    areaId && typeof areaId === "string"
      ? areaMap.get(areaId as UUID)
      : undefined;
  const areaName =
    areaSummary?.name ??
    areaMapEntry?.name ??
    (entry.area_id
      ? t("timeLog.progressBar.unknownArea")
      : t("common.none"));
  const areaColor =
    areaSummary?.color ?? areaMapEntry?.color ?? undefined;

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
            {t("timeLog.tooltip.area")}:
          </dt>
          <dd className="text-base-content">
            <AreaBadge
              areaId={areaId}
              areaMap={areaMap}
              name={areaName}
              color={areaColor ?? undefined}
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
