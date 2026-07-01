import { describe, expect, it } from "vitest";

import { MayanCalendarAdapter } from "@/utils/calendar";

describe("MayanCalendarAdapter", () => {
  const adapter = new MayanCalendarAdapter();

  it("uses July 26 as the year start and July 25 as Day Out of Time", () => {
    expect(adapter.getPeriodRange("year", new Date(2026, 6, 26))).toEqual({
      start: "2026-07-26",
      end: "2027-07-25",
    });
    expect(adapter.getPeriodRange("year", new Date(2026, 6, 25))).toEqual({
      start: "2025-07-26",
      end: "2026-07-25",
    });
    expect(adapter.getPeriodRange("7years", new Date(2026, 6, 26))).toEqual({
      start: "2026-07-26",
      end: "2033-07-25",
    });
    expect(adapter.getPeriodRange("month", new Date(2027, 6, 25))).toEqual({
      start: "2027-07-25",
      end: "2027-07-25",
    });
  });

  it("builds 28-day moon and fixed seven-day week ranges", () => {
    expect(adapter.getPeriodRange("month", new Date(2026, 6, 26))).toEqual({
      start: "2026-07-26",
      end: "2026-08-22",
    });
    expect(adapter.getPeriodRange("week", new Date(2026, 7, 2))).toEqual({
      start: "2026-08-02",
      end: "2026-08-08",
    });
  });

  it("enumerates thirteen moon options for a Mayan year", () => {
    const options = adapter.getMonthOptions(new Date(2026, 6, 26));

    expect(options).toHaveLength(13);
    expect(options[0]).toEqual({
      index: 1,
      name: "1 2026-07-26",
    });
    expect(options[12]).toEqual({
      index: 13,
      name: "13 2027-06-27",
    });
  });
});
