import { describe, expect, it } from "vitest";

import {
  formatCurrencyValue,
  formatPercentValue,
  getTradingCsvTemplate,
  parseTradingCsv,
} from "@/features/finance/trading/utils";

describe("trading utils", () => {
  it("formats currency values", () => {
    expect(formatCurrencyValue("1000", "USD")).toContain("$1,000.00");
    expect(formatCurrencyValue(null, "USD")).toBe("--");
  });

  it("formats percent values", () => {
    expect(formatPercentValue("0.1234")).toBe("12.34%");
    expect(formatPercentValue(null)).toBe("--");
  });

  it("provides CSV template", () => {
    const template = getTradingCsvTemplate();
    expect(template.split("\n")).toHaveLength(2);
  });

  it("parses CSV rows", () => {
    const rows = parseTradingCsv(
      "instrument_symbol,trade_time,direction,base_delta,quote_delta\nBTC/USDT,2025-01-01T00:00:00Z,buy,1,-2000",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].instrument_symbol).toBe("BTC/USDT");
  });
});
