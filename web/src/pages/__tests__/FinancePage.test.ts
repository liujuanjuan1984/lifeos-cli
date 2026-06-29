import { describe, expect, it } from "vitest";

import { FINANCE_TOOLBAR_ORDER } from "@/features/finance/utils";

describe("FinancePage", () => {
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
