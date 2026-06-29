import { describe, expect, it } from "vitest";

import { DEFAULT_FINANCE_TAB, FINANCE_TOOLBAR_ORDER } from "@/features/finance/utils";

describe("FinancePage", () => {
  it("opens the finance tree tab by default", () => {
    expect(DEFAULT_FINANCE_TAB).toBe("trees");
  });

  it("keeps finance toolbar tabs in the product order", () => {
    expect(FINANCE_TOOLBAR_ORDER).toEqual([
      "assets",
      "trees",
      "rates",
      "balance",
      "cashflow",
    ]);
  });
});
