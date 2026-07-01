import { describe, expect, it } from "vitest";

import {
  getFullCalendarFirstDay,
  getMayanYearFirstDayOfWeekPreference,
  GregorianCalendarAdapter,
  javascriptDayToWeekPreference,
  MayanCalendarAdapter,
} from "@/utils/calendar";

describe("getFullCalendarFirstDay", () => {
  it("maps Gregorian Sunday from stored 7 to FullCalendar 0", () => {
    expect(
      getFullCalendarFirstDay(
        "gregorian",
        new GregorianCalendarAdapter(7),
        new Date(2026, 6, 26),
        7,
      ),
    ).toBe(0);
  });

  it("keeps Gregorian weekday preferences unchanged", () => {
    expect(
      getFullCalendarFirstDay(
        "gregorian",
        new GregorianCalendarAdapter(3),
        new Date(2026, 6, 26),
        3,
      ),
    ).toBe(3);
  });

  it("anchors Mayan weeks to the current Mayan year start", () => {
    expect(
      getFullCalendarFirstDay(
        "mayan_13_moon",
        new MayanCalendarAdapter(1),
        new Date(2026, 7, 10),
        1,
      ),
    ).toBe(new Date(2026, 6, 26).getDay());
  });

  it("maps JavaScript Sunday to the stored week preference value", () => {
    expect(javascriptDayToWeekPreference(0)).toBe(7);
    expect(javascriptDayToWeekPreference(6)).toBe(6);
  });

  it("derives the Mayan first day preference from the current Mayan year", () => {
    expect(getMayanYearFirstDayOfWeekPreference(new Date(2026, 4, 1))).toBe(
      6,
    );
    expect(getMayanYearFirstDayOfWeekPreference(new Date(2026, 6, 28))).toBe(
      7,
    );
  });
});
