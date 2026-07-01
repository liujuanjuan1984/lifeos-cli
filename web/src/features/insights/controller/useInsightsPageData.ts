import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";
import { useCalendarAdapter } from "@/hooks/useCalendarAdapter";
import type { CalendarAdapter } from "@/utils/calendar";
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
  const {
    adapter: calendarAdapter,
    calendarSystem,
    firstDayOfWeek,
    loading: calendarLoading,
  } = useCalendarAdapter();

  const timezonePreferenceState = usePreferenceWithBootstrap<string>({
    key: "system.timezone",
    defaultValue: resolvePreferredTimezone(),
    module: "system",
    validator: (value) => typeof value === "string" && value.length > 0,
  });

  const activeTimezone = resolvePreferredTimezone(
    timezonePreferenceState.value,
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
    calendarLoading,
  };
}
