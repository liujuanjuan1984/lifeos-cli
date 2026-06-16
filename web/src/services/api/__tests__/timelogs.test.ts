import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "@/services/api/endpoints";
import { timelogsApi } from "@/services/api/timelogs";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("timelogsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches ranges with exact UTC window boundaries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 1, size: 50, total: 0, pages: 0 },
          meta: {},
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await timelogsApi.fetchRange(
      "2026-04-10T16:00:00.000Z",
      "2026-04-11T15:59:59.999Z",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.TIMELOGS.BASE))).toBe(true);
    expect(parsedUrl.searchParams.get("window_start")).toBe(
      "2026-04-10T16:00:00.000Z",
    );
    expect(parsedUrl.searchParams.get("window_end")).toBe(
      "2026-04-11T15:59:59.999Z",
    );
    expect(parsedUrl.searchParams.get("page")).toBe("1");
    expect(parsedUrl.searchParams.get("size")).toBe("500");
    expect(parsedUrl.searchParams.get("start_date")).toBeNull();
    expect(parsedUrl.searchParams.get("end_date")).toBeNull();
    expect(init.method).toBe("GET");
  });

  it("fetches every range page while backend reports truncation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "event-2",
                title: "Later event",
                start_time: "2026-04-14T15:00:00.000Z",
                end_time: "2026-04-14T15:30:00.000Z",
                area_id: null,
                tracking_method: "manual",
                created_at: "2026-04-14T15:00:00.000Z",
                updated_at: "2026-04-14T15:00:00.000Z",
              },
            ],
            pagination: { page: 1, size: 1, total: 2, pages: 2 },
            meta: {
              returned_count: 1,
              total_count: 2,
              truncated: true,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "event-1",
                title: "Cross-day event",
                start_time: "2026-04-13T15:40:00.000Z",
                end_time: "2026-04-13T17:30:00.000Z",
                area_id: null,
                tracking_method: "manual",
                created_at: "2026-04-13T15:40:00.000Z",
                updated_at: "2026-04-13T15:40:00.000Z",
              },
            ],
            pagination: { page: 2, size: 1, total: 2, pages: 2 },
            meta: {
              returned_count: 1,
              total_count: 2,
              truncated: false,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const response = await timelogsApi.fetchRange(
      "2026-04-13T16:00:00.000Z",
      "2026-04-14T15:59:59.999Z",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get("page")).toBe(
      "1",
    );
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get("page")).toBe(
      "2",
    );
    expect(response.items.map((item) => item.id)).toEqual(["event-2", "event-1"]);
    expect(response.pagination).toEqual({ page: 1, size: 2, total: 2, pages: 1 });
    expect(response.meta.truncated).toBe(false);
    expect(response.meta.returned_count).toBe(2);
    expect(response.meta.total_count).toBe(2);
  });

  it("serializes null area as a without-area filter", async () => {
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

    await timelogsApi.advancedSearch({
      start_date: "2026-06-01T04:00:00.000Z",
      end_date: "2026-06-02T03:59:59.999Z",
      area_id: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.TIMELOGS.BASE))).toBe(true);
    expect(parsedUrl.searchParams.get("window_start")).toBe(
      "2026-06-01T04:00:00.000Z",
    );
    expect(parsedUrl.searchParams.get("window_end")).toBe(
      "2026-06-02T03:59:59.999Z",
    );
    expect(parsedUrl.searchParams.get("start_date")).toBeNull();
    expect(parsedUrl.searchParams.get("end_date")).toBeNull();
    expect(parsedUrl.searchParams.get("area_id")).toBeNull();
    expect(parsedUrl.searchParams.get("without_area")).toBe("true");
    expect(init.method).toBe("GET");
  });

  it("serializes null task as a without-task filter", async () => {
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

    await timelogsApi.advancedSearch({
      start_date: "2026-06-01T04:00:00.000Z",
      end_date: "2026-06-02T03:59:59.999Z",
      task_id: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.TIMELOGS.BASE))).toBe(true);
    expect(parsedUrl.searchParams.get("task_id")).toBeNull();
    expect(parsedUrl.searchParams.get("without_task")).toBe("true");
    expect(init.method).toBe("GET");
  });

  it("omits task filters when advanced search targets all tasks", async () => {
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

    await timelogsApi.advancedSearch({
      start_date: "2026-06-01T04:00:00.000Z",
      end_date: "2026-06-02T03:59:59.999Z",
      task_id: undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(parsedUrl.searchParams.get("task_id")).toBeNull();
    expect(parsedUrl.searchParams.get("without_task")).toBeNull();
  });
});
