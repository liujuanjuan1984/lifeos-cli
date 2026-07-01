import { describe, expect, it } from "vitest";

import {
  formatCompactAmountForAsset,
  rateSnapshotLabel,
  snapshotLabel,
} from "@/features/finance/utils";
import type { FinanceRateSnapshot, FinanceSnapshot } from "@/services/api/finance";

const baseSnapshot = {
  id: "snapshot-1",
  tree_id: "tree-1",
  snapshot_ts: "2026-06-25T12:00:00.000Z",
  period_start: null,
  period_end: null,
  primary_currency: "USD",
  created_at: "2026-06-25T12:00:00.000Z",
} satisfies Partial<FinanceSnapshot>;

describe("finance snapshot labels", () => {
  it("uses a custom title when present", () => {
    expect(
      snapshotLabel({
        ...baseSnapshot,
        title: "June net worth",
      } as FinanceSnapshot),
    ).toBe("June net worth");
  });

  it("falls back to the snapshot timestamp when title is blank", () => {
    expect(
      snapshotLabel({
        ...baseSnapshot,
        title: " ",
      } as FinanceSnapshot),
    ).not.toBe(" ");
  });
});

describe("finance rate snapshot labels", () => {
  it("uses only the captured timestamp", () => {
    const label = rateSnapshotLabel({
      id: "rate-snapshot-1",
      captured_at: "2026-06-25T12:00:00.000Z",
      source: "manual",
      entries: [
        {
          id: "rate-entry-1",
          base_currency: "BTC",
          quote_currency: "USDT",
          rate: "100000",
        },
      ],
    } as FinanceRateSnapshot);

    expect(label).not.toContain("BTC/USDT");
  });
});

describe("finance asset amount formatting", () => {
  it("limits editable values to asset precision and trims trailing zeroes", () => {
    expect(
      formatCompactAmountForAsset(
        "2.340000",
        "USDT",
        [{ id: "asset-usdt", code: "USDT", decimal_places: 6, is_default: true }],
      ),
    ).toBe("2.34");
  });

  it("rounds editable values to the selected asset precision", () => {
    expect(
      formatCompactAmountForAsset(
        "7.129",
        "CNY",
        [{ id: "asset-cny", code: "CNY", decimal_places: 2, is_default: true }],
      ),
    ).toBe("7.13");
  });
});
