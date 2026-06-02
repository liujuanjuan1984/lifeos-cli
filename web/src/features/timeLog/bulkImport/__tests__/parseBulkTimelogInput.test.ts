import { describe, expect, it } from "vitest";

import {
  parseBulkTimelogInput,
  type BulkImportRow,
} from "@/features/timeLog/bulkImport/parseBulkTimelogInput";

const baseDate = new Date("2025-01-01T00:00:00Z");

const toRow = (rows: BulkImportRow[], index: number) => {
  const row = rows[index];
  if (!row) {
    throw new Error(`Row ${index} does not exist`);
  }
  return row;
};

describe("parseBulkTimelogInput", () => {
  it("parses end-only lines and infers start times", () => {
    const result = parseBulkTimelogInput(
      ["0700 早餐", "0830 深度工作", "0100 总结"].join("\n"),
      {
        startDate: baseDate,
        defaultFirstStartTime: "06:30",
      },
    );

    expect(result.globalErrors).toHaveLength(0);
    expect(result.rows).toHaveLength(3);

    const first = toRow(result.rows, 0);
    expect(first.date).toBe("2025-01-01");
    expect(first.startTime).toBe("06:30");
    expect(first.endTime).toBe("07:00");
    expect(first.dimensionId).toBeNull();
    expect(first.personIds).toEqual([]);

    const third = toRow(result.rows, 2);
    expect(third.endDate).toBe("2025-01-02");
    expect(third.warnings[0]?.code).toBe("auto_cross_midnight_end");
  });

  it("handles missing spaces between time and description", () => {
    const result = parseBulkTimelogInput("1510工作", {
      startDate: baseDate,
      defaultFirstStartTime: "15:00",
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.endTime).toBe("15:10");
    expect(row.description).toBe("工作");
  });

  it("parses time range lines with automatic day rollover", () => {
    const result = parseBulkTimelogInput("23:00-00:30 夜间复盘", {
      startDate: baseDate,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.date).toBe("2025-01-01");
    expect(row.startTime).toBe("23:00");
    expect(row.endDate).toBe("2025-01-02");
    expect(row.endTime).toBe("00:30");
    expect(row.warnings[0]?.code).toBe("auto_cross_midnight_range");
    expect(row.taskId).toBeNull();
  });

  it("stops parsing when exceeding the day limit", () => {
    const result = parseBulkTimelogInput(
      "0700 任务\n0800 任务\n0030 次日任务",
      {
        startDate: baseDate,
        maxDays: 1,
      },
    );

    expect(
      result.rows[2].errors.some((m) => m.code === "cross_day_limit"),
    ).toBe(true);
    expect(result.rows[2].errors[0]?.meta?.maxDays).toBe(1);
  });

  it("drops lines beyond the max entry limit", () => {
    const input = Array.from({ length: 3 })
      .map((_, index) => `0${index + 7}00 任務`)
      .join("\n");
    const result = parseBulkTimelogInput(input, {
      startDate: baseDate,
      maxEntries: 2,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.globalErrors[0]).toMatchObject({
      code: "too_many_lines",
      meta: { limit: 2, dropped: 1 },
    });
  });
});
