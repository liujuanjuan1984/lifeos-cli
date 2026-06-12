import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  FocusEvent as ReactFocusEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  AggregatedDimensionRow,
  AggregationGranularity,
  DailyDimensionRow,
} from "@/services/api/stats";
import ErrorDisplay from "@/components/ErrorDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import HoverTooltipOverlay from "@/components/HoverTooltipOverlay";
import { useHoverTooltip } from "@/hooks/useHoverTooltip";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import PageLayout from "@/layouts/PageLayout";
import { formatDate, formatDuration } from "@/utils/datetime";
import { Icon } from "@/components/icons";
import type {
  CalendarAdapter,
  ExtendedPlanningViewType,
} from "@/utils/calendar";
import type { Dimension } from "@/services/api/dimensions";
import ActionButton from "@/components/ActionButton";
import { RadioGroup, SegmentedControl, TextInput } from "@/components/forms";
import PeriodNavigation from "@/components/PeriodNavigation";
import ToolbarContainer from "@/components/ToolbarContainer";
import ListContainer from "@/layouts/ListContainer";
import Container from "@/layouts/Container";
import type { UUID } from "@/types/primitive";
import { useInsightsPageData } from "@/features/insights/controller/useInsightsPageData";
import {
  useInsightsViewState,
  type InsightViewConfig,
  type InsightViewType,
} from "@/features/insights/useInsightsViewState";
import { useInsightsStatsController } from "@/features/insights/controller/useInsightsStatsController";

type DimensionBucket = {
  dimensionId: UUID;
  minutes: number;
  periodStart: string;
  periodEnd: string;
};

interface DimensionTooltipContent {
  title: string;
  lines: string[];
}

const INSIGHT_VIEW_CONFIG: InsightViewConfig = {
  year: { defaultGranularity: "month", options: ["month", "week"] },
  month: { defaultGranularity: "week", options: ["week", "day"] },
  week: { defaultGranularity: "day", options: ["day"] },
  sevenYear: { defaultGranularity: "year", options: ["year", "month"] },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseLocalDate = (isoDate: string): Date => {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  return new Date(year, month, day, 0, 0, 0, 0);
};

const toIsoDate = (date: Date): string => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toLocaleDateString("en-CA");
};

const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const calculateInclusiveDays = (start: string, end?: string | null): number => {
  if (!start) return 0;
  const startDate = parseLocalDate(start);
  const endDate = end ? parseLocalDate(end) : startDate;
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const lower = Math.min(startTime, endTime);
  const upper = Math.max(startTime, endTime);
  const diff = upper - lower;
  return Math.max(1, Math.floor(diff / MS_PER_DAY) + 1);
};

const buildBucketBoundaries = (
  granularity: AggregationGranularity,
  startDate: string,
  endDate: string,
  calendarAdapter: CalendarAdapter,
): Array<{ start: string; end: string }> => {
  if (!startDate || !endDate) return [];
  const buckets: Array<{ start: string; end: string }> = [];
  const rangeStart = parseLocalDate(startDate);
  const rangeEnd = parseLocalDate(endDate);
  const toIso = (d: Date) => toIsoDate(normalizeDate(d));

  const appendBucket = (start: Date, end: Date) => {
    const normalizedStart = normalizeDate(start);
    const normalizedEnd = normalizeDate(end);
    if (normalizedStart > rangeEnd) return;
    const clampedStart =
      normalizedStart < rangeStart ? rangeStart : normalizedStart;
    const clampedEnd = normalizedEnd > rangeEnd ? rangeEnd : normalizedEnd;
    if (clampedStart > clampedEnd) return;
    buckets.push({ start: toIso(clampedStart), end: toIso(clampedEnd) });
  };

  if (granularity === "day") {
    for (
      let cursor = new Date(rangeStart);
      cursor <= rangeEnd;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const iso = toIsoDate(cursor);
      buckets.push({ start: iso, end: iso });
    }
    return buckets;
  }

  const viewTypeMap: Record<
    Exclude<AggregationGranularity, "day">,
    ExtendedPlanningViewType
  > = {
    week: "week",
    month: "month",
    year: "year",
  };

  const viewType =
    viewTypeMap[granularity as Exclude<AggregationGranularity, "day">];
  const parseRange = (range: { start: string; end: string }) => ({
    start: parseLocalDate(range.start),
    end: parseLocalDate(range.end),
  });

  let currentRange = calendarAdapter.getPeriodRange(viewType, rangeStart);
  let { start, end } = parseRange(currentRange);
  let safety = 0;

  while (end < rangeStart && safety < 500) {
    const nextRange = calendarAdapter.shiftPeriodRange(
      viewType,
      currentRange.start,
      currentRange.end,
      1,
    );
    currentRange = nextRange;
    ({ start, end } = parseRange(currentRange));
    safety += 1;
  }

  while (start <= rangeEnd && safety < 1500) {
    appendBucket(start, end);
    if (end >= rangeEnd) break;

    const nextRange = calendarAdapter.shiftPeriodRange(
      viewType,
      currentRange.start,
      currentRange.end,
      1,
    );
    const nextParsed = parseRange(nextRange);
    if (nextParsed.start.getTime() === start.getTime()) {
      // Prevent infinite loops if adapter returns the same range
      break;
    }
    currentRange = nextRange;
    start = nextParsed.start;
    end = nextParsed.end;
    safety += 1;
  }

  return buckets;
};

const calculateBucketCapacityMinutes = (start: string, end: string): number => {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  const diffDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  return Math.max(diffDays, 0) * 24 * 60;
};

const formatBucketLabel = (
  granularity: AggregationGranularity,
  start: string,
  end: string,
): string => {
  if (granularity === "day") return formatDate(start);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
};

const formatBucketTitle = (
  granularity: AggregationGranularity,
  start: string,
  end: string,
): string => {
  return formatBucketLabel(granularity, start, end);
};

// 辅助函数：将十六进制颜色转换为 RGB
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "155, 163, 175"; // 默认灰色
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `${r}, ${g}, ${b}`;
};

// 统计项组件
interface StatisticItemProps {
  day: string;
  rows: DailyDimensionRow[];
  dimensionIdToName: Record<UUID, string>;
  dimensionIdToColor: Record<UUID, string>;
  viewMode: "minutes" | "percent";
  label?: string;
  labelTitle?: string;
  totalMinutesOverride?: number;
}

const StatisticItem: React.FC<StatisticItemProps> = ({
  day,
  rows,
  dimensionIdToName,
  dimensionIdToColor,
  viewMode,
  label,
  labelTitle,
  totalMinutesOverride,
}) => {
  const displayLabel = label ?? formatDate(day);
  const labelTooltip = labelTitle ?? displayLabel;
  const denominator = totalMinutesOverride ?? 1440;
  return (
    <div className="flex items-center gap-3">
      {/* 日期 - 使用常规大小 */}
      <div
        className="w-32 text-base font-medium text-base-content/80 flex-shrink-0 flex items-center justify-center"
        title={labelTooltip}
      >
        {displayLabel}
      </div>

      {/* 条带图 - 改进样式 */}
      <div className="flex-1 min-w-0">
        <div className="flex h-12 bg-base-200 rounded-lg overflow-hidden shadow-sm">
          {rows.map((r) => {
            const widthPct = denominator
              ? Math.min((r.minutes / denominator) * 100, 100)
              : 0;
            const showLabel = widthPct >= 6; // 降低显示标签的阈值
            const duration = formatDuration(Math.round(r.minutes));
            const percentage = denominator
              ? Math.round((r.minutes / denominator) * 100)
              : 0;

            return (
              <div
                key={`bar-${day}-${r.dimension_id}`}
                className="relative flex items-center justify-center"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: `rgba(${hexToRgb(dimensionIdToColor[r.dimension_id] || "#9CA3AF")}, 0.7)`,
                }}
                title={`${dimensionIdToName[r.dimension_id] || `维度${r.dimension_id}`}: ${duration} (${percentage}%)`}
              >
                {showLabel && (
                  <span className="px-2 py-2 text-sm font-medium text-white drop-shadow-sm truncate max-w-full flex items-center justify-center h-full">
                    <span>
                      {viewMode === "percent" ? `${percentage}%` : duration}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

function InsightsPage() {
  const { t } = useTranslation();
  // Page header
  const { setHeader } = usePageHeader();

  useEffect(() => {
    return () => setHeader({ actions: undefined });
  }, [setHeader]);
  const [dimensionIdToName, setDimensionIdToName] = useState<
    Record<UUID, string>
  >({});
  const [dimensionIdToColor, setDimensionIdToColor] = useState<
    Record<UUID, string>
  >({});
  const [selectedDims, setSelectedDims] = useState<Set<UUID>>(new Set());
  const {
    tooltipState: dimensionTooltip,
    showTooltip: showDimensionTooltip,
    schedulePositionUpdate: updateDimensionTooltipPosition,
    hideTooltip: hideDimensionTooltip,
    showTooltipForElement: showDimensionTooltipForElement,
  } = useHoverTooltip<DimensionTooltipContent>({
    defaultOffset: { x: 16, y: -12 },
    focusOffset: (rect) => ({ x: -rect.width / 2, y: -16 }),
  });
  const {
    firstDayOfWeek,
    calendarSystem,
    activeTimezone,
    calendarAdapter,
    dimensions,
    dimensionOrder,
    calendarLoading,
  } = useInsightsPageData();
  const {
    viewMode,
    setViewMode,
    viewType,
    handleViewTypeChange,
    granularity,
    setGranularity,
    selectedDate,
    setSelectedDate,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    ready,
    navigateToPreviousPeriod,
    navigateToCurrentPeriod,
    navigateToNextPeriod,
  } = useInsightsViewState({
    calendarAdapter,
    calendarLoading,
    viewConfig: INSIGHT_VIEW_CONFIG,
  });

  useEffect(() => {
    const dims = Array.isArray(dimensions) ? dimensions : [];
    const idName: Record<UUID, string> = {};
    const idColor: Record<UUID, string> = {};
    const getDisplayOrder = (item: { display_order?: number } | Dimension) => {
      const order = (item as { display_order?: number }).display_order;
      return typeof order === "number" ? order : null;
    };

    const sorted = [...dims].sort((a, b) => {
      const aOrder = getDisplayOrder(a);
      const bOrder = getDisplayOrder(b);

      if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (aOrder !== null) return -1;
      if (bOrder !== null) return 1;

      return (a as { id: UUID }).id.localeCompare((b as { id: UUID }).id);
    });
    sorted.forEach((d) => {
      idName[d.id] = d.name;
      idColor[d.id] = d.color || "#9CA3AF";
    });
    setDimensionIdToName(idName);
    setDimensionIdToColor(idColor);
    // 默认全选所有维度
    setSelectedDims(new Set(dims.map((d) => d.id)));
  }, [dimensions]);

  // 排序：固定使用 Settings 的顺序（useDimensionOrderReadOnly）

  const normalizedFirstDayOfWeek = firstDayOfWeek ?? 1;
  const { dailyStats, aggregatedRows, isLoading, displayError, refreshStats } =
    useInsightsStatsController({
      ready,
      startDate,
      endDate,
      granularity,
      activeTimezone,
      firstDayOfWeek: normalizedFirstDayOfWeek,
      calendarSystem,
      refreshErrorMessage: t("insights.loadingStats"),
    });

  const handleSelectDate = useCallback(
    (date: Date) => {
      const periodRange = calendarAdapter.getPeriodRange(viewType, date);
      setStartDate(periodRange.start);
      setEndDate(periodRange.end);
      setSelectedDate(parseLocalDate(periodRange.start));
    },
    [calendarAdapter, setEndDate, setSelectedDate, setStartDate, viewType],
  );

  // Helpers
  const dayRange = useMemo(() => {
    if (!startDate || !endDate || granularity !== "day") return [] as string[];
    return calendarAdapter.enumerateDates(startDate, endDate);
  }, [startDate, endDate, calendarAdapter, granularity]);

  const groupByDay = useCallback(
    (rows: DailyDimensionRow[]) => {
      const map = new Map<string, DailyDimensionRow[]>();
      rows.forEach((r) => {
        if (!selectedDims.has(r.dimension_id)) return;
        if (!map.has(r.date)) map.set(r.date, []);
        map.get(r.date)!.push(r);
      });
      return map;
    },
    [selectedDims],
  );

  const curByDay = useMemo(
    () => groupByDay(dailyStats),
    [dailyStats, groupByDay],
  );

  const aggregatedBuckets = useMemo(() => {
    if (granularity === "day")
      return [] as Array<{
        key: string;
        periodStart: string;
        periodEnd: string;
        label: string;
        labelTitle: string;
        rows: DailyDimensionRow[];
        capacityMinutes: number;
        totalSelectedMinutes: number;
      }>;

    const boundaries = buildBucketBoundaries(
      granularity,
      startDate,
      endDate,
      calendarAdapter,
    );

    const lookup = new Map<string, AggregatedDimensionRow[]>();
    aggregatedRows.forEach((row) => {
      const key = `${row.period_start}_${row.period_end}`;
      const existing = lookup.get(key);
      if (existing) existing.push(row);
      else lookup.set(key, [row]);
    });

    return boundaries.map(({ start, end }) => {
      const key = `${start}_${end}`;
      const rawRows = lookup.get(key) || [];
      const filteredRows = rawRows.filter((row) =>
        selectedDims.has(row.dimension_id),
      );
      const convertedRows: DailyDimensionRow[] = filteredRows.map((row) => ({
        date: row.period_start,
        dimension_id: row.dimension_id,
        minutes: row.minutes,
      }));
      convertedRows.sort(
        (a, b) =>
          dimensionOrder.indexOf(a.dimension_id) -
          dimensionOrder.indexOf(b.dimension_id),
      );
      const totalSelectedMinutes = convertedRows.reduce(
        (sum, current) => sum + current.minutes,
        0,
      );
      return {
        key,
        periodStart: start,
        periodEnd: end,
        label: formatBucketLabel(granularity, start, end),
        labelTitle: formatBucketTitle(granularity, start, end),
        rows: convertedRows,
        capacityMinutes: calculateBucketCapacityMinutes(start, end),
        totalSelectedMinutes,
      };
    });
  }, [
    aggregatedRows,
    granularity,
    startDate,
    endDate,
    calendarAdapter,
    selectedDims,
    dimensionOrder,
  ]);

  const displayBuckets = useMemo(() => {
    if (granularity === "day") {
      return dayRange.map((day) => {
        const rows = (curByDay.get(day) || [])
          .slice()
          .sort(
            (a, b) =>
              dimensionOrder.indexOf(a.dimension_id) -
              dimensionOrder.indexOf(b.dimension_id),
          );
        const totalSelectedMinutes = rows.reduce(
          (sum, current) => sum + current.minutes,
          0,
        );
        return {
          key: day,
          periodStart: day,
          periodEnd: day,
          label: formatDate(day),
          labelTitle: formatDate(day),
          rows,
          capacityMinutes: 24 * 60,
          totalSelectedMinutes,
        };
      });
    }

    return aggregatedBuckets;
  }, [granularity, dayRange, curByDay, dimensionOrder, aggregatedBuckets]);

  const totalPeriodDayCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    if (granularity === "day") {
      return dayRange.length;
    }

    if (!aggregatedBuckets.length) {
      return calculateInclusiveDays(startDate, endDate);
    }

    return aggregatedBuckets.reduce((sum, bucket) => {
      return sum + calculateInclusiveDays(bucket.periodStart, bucket.periodEnd);
    }, 0);
  }, [granularity, dayRange, aggregatedBuckets, startDate, endDate]);

  const dimensionTotalsMinutes = useMemo(() => {
    const totals = new Map<string, number>();
    const source:
      | Array<Pick<DailyDimensionRow, "dimension_id" | "minutes">>
      | Array<Pick<AggregatedDimensionRow, "dimension_id" | "minutes">> =
      granularity === "day" ? dailyStats : aggregatedRows;

    source.forEach((row) => {
      const key = String(row.dimension_id);
      totals.set(key, (totals.get(key) ?? 0) + row.minutes);
    });

    return totals;
  }, [dailyStats, aggregatedRows, granularity]);

  const dimensionInsightStats = useMemo(() => {
    const bucketSource: DimensionBucket[] =
      granularity === "day"
        ? dailyStats.map((row) => ({
            dimensionId: row.dimension_id,
            minutes: row.minutes ?? 0,
            periodStart: row.date,
            periodEnd: row.date,
          }))
        : aggregatedRows.map((row) => ({
            dimensionId: row.dimension_id,
            minutes: row.minutes ?? 0,
            periodStart: row.period_start,
            periodEnd: row.period_end,
          }));

    const statsMap = new Map<
      string,
      {
        totalMinutes: number;
        totalDayCount: number;
        activeDayCount: number;
        averagePerTotalDay: number | null;
        averagePerActiveDay: number | null;
        maxBucket: DimensionBucket | null;
        minBucket: DimensionBucket | null;
        lastActiveDate: string | null;
      }
    >();

    bucketSource.forEach((bucket) => {
      const key = String(bucket.dimensionId);
      const minutes = Number.isFinite(bucket.minutes) ? bucket.minutes : 0;
      let entry = statsMap.get(key);
      if (!entry) {
        entry = {
          totalMinutes: 0,
          totalDayCount: 0,
          activeDayCount: 0,
          averagePerTotalDay: null,
          averagePerActiveDay: null,
          maxBucket: null,
          minBucket: null,
          lastActiveDate: null,
        };
      }

      entry.totalMinutes += minutes;
      const dayCount = calculateInclusiveDays(
        bucket.periodStart,
        bucket.periodEnd,
      );

      if (!entry.maxBucket || minutes > entry.maxBucket.minutes) {
        entry.maxBucket = { ...bucket };
      }

      if (!entry.minBucket || minutes < entry.minBucket.minutes) {
        entry.minBucket = { ...bucket };
      }

      if (minutes > 0) {
        entry.activeDayCount += dayCount;
        const bucketEnd = bucket.periodEnd || bucket.periodStart;
        if (
          bucketEnd &&
          (!entry.lastActiveDate || bucketEnd > entry.lastActiveDate)
        ) {
          entry.lastActiveDate = bucketEnd;
        }
      }

      statsMap.set(key, entry);
    });

    statsMap.forEach((entry) => {
      entry.totalDayCount = totalPeriodDayCount;
      const clampedActiveDays = Math.min(
        entry.activeDayCount,
        totalPeriodDayCount,
      );
      entry.activeDayCount = clampedActiveDays;
      entry.averagePerTotalDay =
        totalPeriodDayCount > 0
          ? entry.totalMinutes / totalPeriodDayCount
          : null;
      entry.averagePerActiveDay =
        clampedActiveDays > 0 ? entry.totalMinutes / clampedActiveDays : null;
    });

    return statsMap;
  }, [granularity, dailyStats, aggregatedRows, totalPeriodDayCount]);

  const describeBucketRange = useCallback((bucket: DimensionBucket | null) => {
    if (!bucket) return "";
    const { periodStart, periodEnd } = bucket;
    if (!periodStart && !periodEnd) return "";
    if (!periodEnd || periodStart === periodEnd) {
      return formatDate(periodStart || periodEnd);
    }
    return `${formatDate(periodStart)}—${formatDate(periodEnd)}`;
  }, []);

  const getGranularityLabel = useCallback(
    (value: AggregationGranularity) => {
      switch (value) {
        case "day":
          return t("target.day");
        case "week":
          return t("target.week");
        case "month":
          return t("target.month");
        case "year":
        default:
          return t("target.year");
      }
    },
    [t],
  );

  const buildDimensionTooltipContent = useCallback(
    (options: {
      name: string;
      totalDuration: string;
      averages: {
        totalDays?: { duration: string; days: number } | null;
        activeDays?: { duration: string; days: number } | null;
      };
      maxBucket?: { duration: string; range?: string | null } | null;
      minBucket?: { duration: string; range?: string | null } | null;
      lastActive: string;
    }): DimensionTooltipContent => {
      const lines: string[] = [
        t("insights.dimensionTooltip.total", {
          duration: options.totalDuration,
        }),
      ];

      const totalDays = options.averages.totalDays;
      if (totalDays?.duration) {
        lines.push(
          t("insights.dimensionTooltip.averagePerTotalDays", {
            duration: totalDays.duration,
            days: totalDays.days,
          }),
        );
      }

      const activeDays = options.averages.activeDays;
      if (activeDays?.duration) {
        lines.push(
          t("insights.dimensionTooltip.averagePerActiveDays", {
            duration: activeDays.duration,
            days: activeDays.days,
          }),
        );
      }

      if (options.maxBucket) {
        const rangeText = options.maxBucket.range
          ? t("insights.dimensionTooltip.rangeSuffix", {
              range: options.maxBucket.range,
            })
          : "";
        lines.push(
          t("insights.dimensionTooltip.max", {
            duration: options.maxBucket.duration,
            range: rangeText,
          }),
        );
      }

      if (options.minBucket) {
        const rangeText = options.minBucket.range
          ? t("insights.dimensionTooltip.rangeSuffix", {
              range: options.minBucket.range,
            })
          : "";
        lines.push(
          t("insights.dimensionTooltip.min", {
            duration: options.minBucket.duration,
            range: rangeText,
          }),
        );
      }

      lines.push(
        t("insights.dimensionTooltip.lastActive", {
          date: options.lastActive,
        }),
      );

      return {
        title: t("insights.dimensionTooltip.title", { name: options.name }),
        lines,
      };
    },
    [t],
  );

  const handleDimensionMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLElement>, content: DimensionTooltipContent) => {
      showDimensionTooltip({
        payload: content,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [showDimensionTooltip],
  );

  const handleDimensionMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLElement>, content: DimensionTooltipContent) => {
      if (!dimensionTooltip) {
        showDimensionTooltip({
          payload: content,
          position: { x: event.clientX, y: event.clientY },
        });
        return;
      }
      updateDimensionTooltipPosition({
        x: event.clientX,
        y: event.clientY,
      });
    },
    [dimensionTooltip, showDimensionTooltip, updateDimensionTooltipPosition],
  );

  const handleDimensionFocus = useCallback(
    (event: ReactFocusEvent<HTMLElement>, content: DimensionTooltipContent) => {
      showDimensionTooltipForElement(content, event.currentTarget);
    },
    [showDimensionTooltipForElement],
  );

  const handleDimensionMouseLeave = useCallback(() => {
    hideDimensionTooltip();
  }, [hideDimensionTooltip]);

  const granularityOptions = INSIGHT_VIEW_CONFIG[viewType].options;
  const hasGranularityToggle = granularityOptions.length > 0;
  // 固定 URL：不写入任何查询参数

  return (
    <PageLayout>
      {/* 统计工具条（响应式布局） */}
      <ToolbarContainer
        className="mb-4 w-full max-w-full overflow-hidden"
        variant="compact"
        padding="md"
        layout="three-column"
      >
        {/* 左列：视图选择器 */}
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-bold shrink-0">
              {t("insights.viewType.label")}
            </span>
            <SegmentedControl
              value={viewType}
              options={[
                {
                  value: "sevenYear",
                  label: t("planning.viewType.sevenYear"),
                },
                { value: "year", label: t("planning.viewType.year") },
                { value: "month", label: t("planning.viewType.month") },
                { value: "week", label: t("target.week") },
              ]}
              onChange={(nextValue) =>
                handleViewTypeChange(nextValue as InsightViewType)
              }
            />
          </div>
          <div
            className={`flex items-center gap-1 sm:gap-2 flex-wrap ${hasGranularityToggle ? "" : "invisible pointer-events-none"}`}
            aria-hidden={!hasGranularityToggle}
          >
            <span className="text-sm sm:text-base font-bold shrink-0">
              {t("insights.granularity.label")}
            </span>
            <div className="min-h-[2.5rem] md:min-h-[2.75rem]">
              {hasGranularityToggle ? (
                <SegmentedControl
                  value={granularity}
                  options={granularityOptions.map((option) => ({
                    value: option,
                    label: getGranularityLabel(option),
                  }))}
                  onChange={(nextValue) =>
                    setGranularity(nextValue as AggregationGranularity)
                  }
                />
              ) : (
                <span className="inline-flex h-[2.5rem] md:h-[2.75rem]" />
              )}
            </div>
          </div>
        </div>

        {/* 中列：日期导航（居中） */}
        <div className="flex items-center justify-center w-full lg:w-auto">
          <PeriodNavigation
            periodType={viewType}
            selectedDate={selectedDate}
            onPrevious={navigateToPreviousPeriod}
            onNext={navigateToNextPeriod}
            onCurrent={navigateToCurrentPeriod}
            onSelectDate={handleSelectDate}
            centerButtonWidth="xl"
            startDate={startDate}
            endDate={endDate}
          />
        </div>

        {/* 右列：功能按钮 */}
        <div className="hidden lg:flex justify-end gap-2">
          <ActionButton
            label={t("insights.refreshStats")}
            onClick={() => void refreshStats()}
            disabled={isLoading}
            color="primary"
            variant="solid"
            icon={
              isLoading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <Icon name="refresh" size={16} aria-hidden />
              )
            }
            className="font-normal text-base"
            size="sm"
          />
        </div>
      </ToolbarContainer>

      {/* 视图模式和对比选项 - 响应式布局 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-4 text-base text-base-content">
        <div className="flex items-center gap-4 flex-wrap">
          <RadioGroup
            direction="horizontal"
            size="sm"
            value={viewMode}
            options={[
              {
                value: "minutes",
                label: t("insights.viewMode.minutes"),
              },
              {
                value: "percent",
                label: t("insights.viewMode.percent"),
              },
            ]}
            onChange={(nextValue) => setViewMode(nextValue as typeof viewMode)}
          />
        </div>
        {/* 日期范围输入 */}
        <div className="flex items-center gap-3 sm:ml-auto">
          <TextInput
            id="start-date"
            name="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            size="sm"
            title={t("insights.dateRange.startDateTitle")}
          />
          <span className="hidden sm:inline">→</span>
          <TextInput
            id="end-date"
            name="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            size="sm"
            title={t("insights.dateRange.endDateTitle")}
          />
        </div>
      </div>

      {isLoading && <LoadingSpinner message={t("insights.loadingStats")} />}
      <ErrorDisplay error={displayError} className="mb-6" />

      {/* 维度按钮行（从 headerAction 移出，置于列表上方） */}
      {!displayError && (
        <Container
          className="mb-4 w-full max-w-full"
          overflow="hidden"
          maxHeight="fit"
          padding="responsive"
        >
          {isLoading ? (
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-9 w-32 rounded-full bg-base-300/70 animate-pulse sm:w-36"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(dimensionIdToName)
                .filter(([idStr]) => idStr && idStr.trim() !== "") // 过滤无效的ID
                .sort(([aId], [bId]) => {
                  // Use UUID strings directly, don't convert to numbers
                  const ai = dimensionOrder.indexOf(aId);
                  const bi = dimensionOrder.indexOf(bId);
                  const aPos = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
                  const bPos = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
                  return aPos - bPos;
                })
                .map(([idStr, name]) => {
                  const selected = selectedDims.has(idStr);

                  // 计算该维度的总时长
                  const totalMinutes = Math.round(
                    dimensionTotalsMinutes.get(idStr) ?? 0,
                  );
                  const stats = dimensionInsightStats.get(idStr);
                  const maxLabel = describeBucketRange(
                    stats?.maxBucket ?? null,
                  );
                  const minLabel = describeBucketRange(
                    stats?.minBucket ?? null,
                  );
                  const lastActiveLabel = stats?.lastActiveDate
                    ? formatDate(stats.lastActiveDate)
                    : "—";
                  const totalDayCount = stats?.totalDayCount ?? 0;
                  const activeDayCount = stats?.activeDayCount ?? 0;
                  const averagePerTotalDay = stats?.averagePerTotalDay ?? null;
                  const averagePerActiveDay =
                    stats?.averagePerActiveDay ?? null;
                  const totalDurationText = formatDuration(totalMinutes);
                  const averageTotalDaysText =
                    averagePerTotalDay && averagePerTotalDay > 0
                      ? formatDuration(Math.round(averagePerTotalDay))
                      : null;
                  const averageActiveDaysText =
                    averagePerActiveDay && averagePerActiveDay > 0
                      ? formatDuration(Math.round(averagePerActiveDay))
                      : null;
                  const tooltipContent = buildDimensionTooltipContent({
                    name,
                    totalDuration: totalDurationText,
                    averages: {
                      totalDays:
                        totalDayCount > 0 && averageTotalDaysText
                          ? {
                              duration: averageTotalDaysText,
                              days: totalDayCount,
                            }
                          : null,
                      activeDays:
                        activeDayCount > 0 && averageActiveDaysText
                          ? {
                              duration: averageActiveDaysText,
                              days: activeDayCount,
                            }
                          : null,
                    },
                    maxBucket: stats?.maxBucket
                      ? {
                          duration: formatDuration(
                            Math.round(stats.maxBucket.minutes),
                          ),
                          range: maxLabel || null,
                        }
                      : null,
                    minBucket: stats?.minBucket
                      ? {
                          duration: formatDuration(
                            Math.round(stats.minBucket.minutes),
                          ),
                          range: minLabel || null,
                        }
                      : null,
                    lastActive: lastActiveLabel,
                  });

                  // 使用 ActionButton 的样式类，但用原生 button 支持复杂内容
                  const baseClasses = [
                    "btn",
                    selected ? "btn-primary/40" : "btn-neutral/40",
                    selected ? "" : "btn-ghost",
                    "btn-xs",
                    "min-w-32 max-w-40 flex-shrink-0",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={idStr}
                      className={baseClasses}
                      onClick={() => {
                        setSelectedDims((prev) => {
                          const next = new Set(prev);
                          if (next.has(idStr)) next.delete(idStr);
                          else next.add(idStr);
                          return next;
                        });
                      }}
                      onMouseEnter={(event) =>
                        handleDimensionMouseEnter(event, tooltipContent)
                      }
                      onMouseMove={(event) =>
                        handleDimensionMouseMove(event, tooltipContent)
                      }
                      onMouseLeave={handleDimensionMouseLeave}
                      onFocus={(event) =>
                        handleDimensionFocus(event, tooltipContent)
                      }
                      onBlur={handleDimensionMouseLeave}
                    >
                      <div className="flex items-center gap-1 w-full min-w-0">
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              dimensionIdToColor[idStr] || "#9CA3AF",
                          }}
                        />
                        <span className="font-medium text-base-content truncate">
                          {name}
                        </span>
                        <span className="font-normal text-base-content ml-1 flex-shrink-0">
                          ({formatDuration(totalMinutes)})
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </Container>
      )}

      {/* 统计视图（使用 ListContainer 重构） */}
      {!displayError && (
        <ListContainer
          title={t("insights.statsTitle")}
          emptyState={
            <div className="text-center py-12">
              <Icon
                name="chart"
                size={40}
                className="mb-3 text-primary"
                aria-hidden
              />
              <h3 className="text-lg font-bold font-medium mb-2 text-base-content">
                {t("insights.noStats")}
              </h3>
              <p className="text-base text-base-content/60">
                {t("insights.noStatsDescription")}
              </p>
            </div>
          }
          shadow={true}
          className="mb-6 w-full max-w-full overflow-hidden"
        >
          {isLoading ? (
            <div className="space-y-2 p-4" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 w-full rounded-lg bg-base-200 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayBuckets.map((bucket) => (
                <div
                  key={bucket.key}
                  className="hover:bg-base-50 rounded-lg p-2 transition-colors duration-200"
                >
                  <StatisticItem
                    day={bucket.periodStart}
                    rows={bucket.rows}
                    dimensionIdToName={dimensionIdToName}
                    dimensionIdToColor={dimensionIdToColor}
                    viewMode={viewMode}
                    label={bucket.label}
                    labelTitle={bucket.labelTitle}
                    totalMinutesOverride={bucket.capacityMinutes}
                  />
                </div>
              ))}
            </div>
          )}
        </ListContainer>
      )}
      <HoverTooltipOverlay
        visible={Boolean(dimensionTooltip)}
        position={dimensionTooltip?.position ?? null}
        offset={dimensionTooltip?.offset}
        className="text-sm leading-relaxed max-w-sm sm:max-w-md"
      >
        {dimensionTooltip?.payload && (
          <div>
            <div className="font-semibold mb-2 text-base-content">
              {dimensionTooltip.payload.title}
            </div>
            <ul className="space-y-1 text-base-content/80">
              {dimensionTooltip.payload.lines.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </HoverTooltipOverlay>
    </PageLayout>
  );
}

export default InsightsPage;
