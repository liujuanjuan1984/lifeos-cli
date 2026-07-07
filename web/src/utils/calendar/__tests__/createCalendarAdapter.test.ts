import { describe, expect, it } from "vitest";

import {
  createCalendarAdapter,
  GregorianCalendarAdapter,
  MayanCalendarAdapter,
} from "@/utils/calendar";

describe("createCalendarAdapter", () => {
  it("creates Gregorian adapter by default", () => {
    const adapter = createCalendarAdapter("gregorian", 1);
    expect(adapter).toBeInstanceOf(GregorianCalendarAdapter);
  });

  it("creates Mayan adapter when requested", () => {
    const adapter = createCalendarAdapter("mayan_13_moon", 1);
    expect(adapter).toBeInstanceOf(MayanCalendarAdapter);
  });

  it("throws for unsupported calendar systems", () => {
    expect(() => createCalendarAdapter("martian" as never, 1)).toThrowError(
      /Unsupported calendar system/,
    );
  });
});
