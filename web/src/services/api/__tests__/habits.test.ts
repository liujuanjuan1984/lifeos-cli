import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "@/services/api/endpoints";
import { habitsApi } from "@/services/api/habits";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("habitsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queries habit actions through the planning date range", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 1, size: 1000, total: 0, pages: 0 },
          meta: {
            start_date: "2026-04-01",
            end_date: "2026-04-30",
            reference_date: "2026-04-09",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await habitsApi.getActionsInRange({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      referenceDate: "2026-04-09",
      page: 1,
      size: 1000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.HABITS.ACTIONS_IN_RANGE))).toBe(
      true,
    );
    expect(parsedUrl.searchParams.get("start_date")).toBe("2026-04-01");
    expect(parsedUrl.searchParams.get("end_date")).toBe("2026-04-30");
    expect(parsedUrl.searchParams.get("reference_date")).toBe("2026-04-09");
    expect(parsedUrl.searchParams.get("page")).toBe("1");
    expect(parsedUrl.searchParams.get("size")).toBe("1000");
    expect(init.method).toBe("GET");
  });
});
