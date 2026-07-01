import { describe, expect, it } from "vitest";

import {
  getFullCalendarFirstDay,
  GregorianCalendarAdapter,
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

  it("anchors Mayan weeks to the Mayan year that contains the target date", () => {
    expect(
      getFullCalendarFirstDay(
        "mayan_13_moon",
        new MayanCalendarAdapter(1),
        new Date(2026, 4, 1),
        1,
      ),
    ).toBe(new Date(2025, 6, 26).getDay());
    expect(
      getFullCalendarFirstDay(
        "mayan_13_moon",
        new MayanCalendarAdapter(1),
        new Date(2026, 6, 28),
        1,
      ),
    ).toBe(new Date(2026, 6, 26).getDay());
  });
});
