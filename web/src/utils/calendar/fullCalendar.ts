import type { CalendarAdapter } from "./CalendarAdapter";
import type { CalendarSystem } from "./createCalendarAdapter";

export function getFullCalendarFirstDay(
  calendarSystem: CalendarSystem,
  adapter: CalendarAdapter,
  referenceDate: Date,
  firstDayOfWeek: number,
): number {
  if (calendarSystem === "mayan_13_moon") {
    return adapter.getYearStart(referenceDate).getDay();
  }

  return firstDayOfWeek === 7 ? 0 : firstDayOfWeek;
}
