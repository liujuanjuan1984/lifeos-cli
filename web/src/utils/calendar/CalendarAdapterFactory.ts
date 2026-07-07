import type { CalendarAdapter } from "./CalendarAdapter";
import { DEFAULT_SEVEN_YEAR_ANCHOR_DATE } from "./CalendarAdapter";
import { GregorianCalendarAdapter } from "./GregorianCalendarAdapter";
import { MayanCalendarAdapter } from "./MayanCalendarAdapter";

export type CalendarSystem = "gregorian" | "mayan_13_moon";

/**
 * Factory class for creating calendar adapters
 * Provides a centralized way to create calendar adapters based on the calendar system
 */
export class CalendarAdapterFactory {
  /**
   * Create a calendar adapter based on the calendar system
   * @param system - The calendar system to use
   * @param firstDayOfWeek - First day of week (1=Monday, 2=Tuesday, ..., 7=Sunday)
   * @param sevenYearAnchorDate - Date used to anchor seven-year period boundaries
   * @returns Calendar adapter instance
   */
  static create(
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
}
