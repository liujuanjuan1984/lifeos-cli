import type { CalendarAdapter } from "./CalendarAdapter";
import { DEFAULT_SEVEN_YEAR_ANCHOR_DATE } from "./CalendarAdapter";
import { GregorianCalendarAdapter } from "./GregorianCalendarAdapter";
import { MayanCalendarAdapter } from "./MayanCalendarAdapter";

export type CalendarSystem = "gregorian" | "mayan_13_moon";

export function createCalendarAdapter(
  system: CalendarSystem,
  firstDayOfWeek: number = 1,
  sevenYearAnchorDate: string = DEFAULT_SEVEN_YEAR_ANCHOR_DATE,
): CalendarAdapter {
  switch (system) {
    case "gregorian":
      return new GregorianCalendarAdapter(firstDayOfWeek, sevenYearAnchorDate);
    case "mayan_13_moon":
      return new MayanCalendarAdapter(firstDayOfWeek, sevenYearAnchorDate);
    default:
      throw new Error(`Unsupported calendar system: ${system}`);
  }
}
