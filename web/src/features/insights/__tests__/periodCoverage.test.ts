import { describe, expect, it } from "vitest";

import { buildPeriodCoverage } from "@/features/insights/periodCoverage";

describe("periodCoverage", () => {
  it("formats whole-hour coverage without decimals", () => {
    expect(buildPeriodCoverage(24 * 60, 144 * 60).label).toBe("24/144");
  });

  it("keeps partial-hour coverage visible", () => {
    expect(buildPeriodCoverage(23 * 60 + 30, 24 * 60).label).toBe("23.5/24");
    expect(buildPeriodCoverage(23 * 60 + 59, 24 * 60).label).toBe("23.98/24");
  });

  it("marks coverage complete only when actual minutes match capacity minutes", () => {
    expect(buildPeriodCoverage(24 * 60, 24 * 60)).toEqual({
      label: "24/24",
      isComplete: true,
    });
    expect(buildPeriodCoverage(143 * 60, 144 * 60)).toMatchObject({
      label: "143/144",
      isComplete: false,
    });
  });
});
