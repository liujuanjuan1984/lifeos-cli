import { describe, expect, it } from "vitest";

import { snapshotLabel } from "@/features/finance/utils";
import type { FinanceSnapshot } from "@/services/api/finance";

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
