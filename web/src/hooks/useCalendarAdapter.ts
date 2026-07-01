import { useMemo } from "react";
import { usePreferenceWithBootstrap } from "./queries/usePreferenceWithBootstrap";
import { CalendarAdapterFactory } from "@/utils/calendar";
import type {
  CalendarAdapter,
  CalendarSystem,
  ExtendedPlanningViewType,
} from "@/utils/calendar";

interface CalendarAdapterState {
  adapter: CalendarAdapter;
  calendarSystem: CalendarSystem;
  firstDayOfWeek: number;
  loading: boolean;
}

/**
 * Hook to get calendar adapter based on user preferences
 * Provides a unified interface for calendar operations regardless of the underlying calendar system
 */
export function useCalendarAdapter(): CalendarAdapterState {
  const calendarSystemPreference = usePreferenceWithBootstrap<CalendarSystem>({
    key: "calendar.system",
    defaultValue: "gregorian",
    module: "calendar",
    validator: (value) => value === "gregorian" || value === "mayan_13_moon",
  });

  const firstDayPreference = usePreferenceWithBootstrap<number>({
    key: "calendar.first_day_of_week",
    defaultValue: 1,
    module: "calendar",
    validator: (value) => Number.isFinite(value) && value >= 1 && value <= 7,
  });

  const calendarSystem: CalendarSystem =
    calendarSystemPreference.value === "mayan_13_moon"
      ? "mayan_13_moon"
      : "gregorian";
  const firstDayOfWeek = Number.isFinite(firstDayPreference.value)
    ? firstDayPreference.value
    : 1;

  const adapter = useMemo(() => {
    return CalendarAdapterFactory.create(calendarSystem, firstDayOfWeek);
  }, [calendarSystem, firstDayOfWeek]);

  return {
    adapter,
    calendarSystem,
    firstDayOfWeek,
    loading: calendarSystemPreference.loading || firstDayPreference.loading,
  };
}

/**
 * Hook for planning cycle operations
 * Provides convenient methods for setting up planning cycles
 */
export function usePlanningCycle() {
  const { adapter, calendarSystem } = useCalendarAdapter();

  /**
   * Get default planning cycle settings for a given cycle type
   */
  const getDefaultCycleSettings = (
    cycleType: ExtendedPlanningViewType,
    baseDate: Date = new Date(),
  ) => {
    const yearStart = adapter.getYearStart(baseDate);
    const monthInfo = adapter.getMonthInfo(baseDate);
    const startDate = monthInfo.monthStart || baseDate;
    const days = adapter.getPlanningCycleDays(cycleType);

    // Override start date based on cycle type
    switch (cycleType) {
      case "year":
        startDate.setTime(yearStart.getTime());
        break;
      case "7years":
      case "sevenYear":
        startDate.setTime(yearStart.getTime());
        break;
      case "month":
        if (monthInfo.monthStart) {
          startDate.setTime(monthInfo.monthStart.getTime());
        }
        break;
      case "week":
        startDate.setTime(adapter.getWeekStart(baseDate).getTime());
        break;
      case "day":
        startDate.setTime(baseDate.getTime());
        break;
    }

    return {
      startDate: startDate.toLocaleDateString("en-CA"),
      days,
    };
  };

  /**
   * Get quick set options for common planning cycles
   */
  const getQuickSetOptions = (baseDate: Date = new Date()) => {
    // Calculate tomorrow's date
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      today: getDefaultCycleSettings("day", baseDate),
      tomorrow: getDefaultCycleSettings("day", tomorrow),
      thisWeek: getDefaultCycleSettings("week", baseDate),
      thisMonth: getDefaultCycleSettings("month", baseDate),
      thisYear: getDefaultCycleSettings("year", baseDate),
    };
  };

  return {
    adapter,
    calendarSystem,
    getDefaultCycleSettings,
    getQuickSetOptions,
  };
}
