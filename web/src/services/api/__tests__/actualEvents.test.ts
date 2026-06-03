import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "@/services/api/endpoints";
import { actualEventsApi } from "@/services/api/actualEvents";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("actualEventsApi.advancedSearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes null dimension as a without-dimension filter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 1, size: 500, total: 0, pages: 0 },
          meta: {},
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await actualEventsApi.advancedSearch({
      start_date: "2026-06-01T04:00:00.000Z",
      end_date: "2026-06-02T03:59:59.999Z",
      dimension_id: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.TIMELOGS.BASE))).toBe(true);
    expect(parsedUrl.searchParams.get("dimension_id")).toBeNull();
    expect(parsedUrl.searchParams.get("without_dimension")).toBe("true");
    expect(init.method).toBe("GET");
  });
});
