import type { CalendarAdapter } from "./CalendarAdapter";
import type { CalendarSystem } from "./CalendarAdapterFactory";
import { MayanCalendarAdapter } from "./MayanCalendarAdapter";

export function javascriptDayToWeekPreference(day: number): number {
  return day === 0 ? 7 : day;
}

export function getMayanYearFirstDayOfWeekPreference(
  referenceDate: Date = new Date(),
): number {
  const adapter = new MayanCalendarAdapter();
  return javascriptDayToWeekPreference(
    adapter.getYearStart(referenceDate).getDay(),
  );
}

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
