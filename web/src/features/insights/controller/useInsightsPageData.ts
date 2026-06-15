import { useMemo } from "react";
import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";
import { CalendarAdapterFactory, type CalendarAdapter } from "@/utils/calendar";
import { useAreas } from "@/hooks/queries/useAreas";
import { useAreaOrderReadOnly } from "@/hooks/queries/useAreaOrderReadOnly";
import { resolvePreferredTimezone } from "@/utils/datetime";

interface InsightsPageData {
  firstDayOfWeek: number;
  calendarSystem: "gregorian" | "mayan_13_moon";
  activeTimezone: string;
  calendarAdapter: CalendarAdapter;
  areas: ReturnType<typeof useAreas>["areas"];
  areaMap: ReturnType<typeof useAreas>["areaMap"];
  areaOrder: ReturnType<typeof useAreaOrderReadOnly>["order"];
  calendarLoading: boolean;
}

export function useInsightsPageData(): InsightsPageData {
  const firstDayPreference = usePreferenceWithBootstrap<number>({
    key: "calendar.first_day_of_week",
    defaultValue: 1,
    module: "calendar",
    validator: (value) => Number.isFinite(value) && value >= 1 && value <= 7,
  });

  const calendarSystemPreference = usePreferenceWithBootstrap<
    "gregorian" | "mayan_13_moon"
  >({
    key: "calendar.system",
    defaultValue: "gregorian",
    module: "calendar",
    validator: (value) => value === "gregorian" || value === "mayan_13_moon",
  });

  const timezonePreferenceState = usePreferenceWithBootstrap<string>({
    key: "system.timezone",
    defaultValue: resolvePreferredTimezone(),
    module: "system",
    validator: (value) => typeof value === "string" && value.length > 0,
  });

  const activeTimezone = resolvePreferredTimezone(
    timezonePreferenceState.value,
  );

  const firstDayOfWeek = Number.isFinite(firstDayPreference.value)
    ? (firstDayPreference.value as number)
    : 1;
  const calendarSystem =
    calendarSystemPreference.value === "mayan_13_moon"
      ? "mayan_13_moon"
      : "gregorian";

  const calendarAdapter = useMemo(
    () => CalendarAdapterFactory.create(calendarSystem, firstDayOfWeek),
    [calendarSystem, firstDayOfWeek],
  );

  const { areas, areaMap } = useAreas();
  const { order: areaOrder } = useAreaOrderReadOnly();

  return {
    firstDayOfWeek,
    calendarSystem,
    activeTimezone,
    calendarAdapter,
    areas,
    areaMap,
    areaOrder,
    calendarLoading: calendarSystemPreference.loading,
  };
}
