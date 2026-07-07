import { describe, expect, it } from "vitest";

import {
  CalendarAdapterFactory,
  GregorianCalendarAdapter,
  MayanCalendarAdapter,
} from "@/utils/calendar";

describe("CalendarAdapterFactory", () => {
  it("creates Gregorian adapter by default", () => {
    const adapter = CalendarAdapterFactory.create("gregorian", 1);
    expect(adapter).toBeInstanceOf(GregorianCalendarAdapter);
  });

  it("creates Mayan adapter when requested", () => {
    const adapter = CalendarAdapterFactory.create("mayan_13_moon", 1);
    expect(adapter).toBeInstanceOf(MayanCalendarAdapter);
  });

  it("throws for unsupported calendar systems", () => {
    expect(() =>
      CalendarAdapterFactory.create("martian" as never, 1),
    ).toThrowError(/Unsupported calendar system/);
  });
});
