import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "@/services/api/endpoints";
import { timelogTemplatesApi } from "@/services/api/timelogTemplates";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("timelogTemplatesApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists timelog templates with pagination and ordering", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 1, size: 50, total: 0, pages: 0 },
          meta: { order_by: "position" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await timelogTemplatesApi.list({ page: 2, size: 25, order_by: "usage" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.TIMELOGS.TEMPLATES.BASE))).toBe(
      true,
    );
    expect(parsedUrl.searchParams.get("page")).toBe("2");
    expect(parsedUrl.searchParams.get("size")).toBe("25");
    expect(parsedUrl.searchParams.get("order_by")).toBe("usage");
    expect(init.method).toBe("GET");
  });

  it("creates and updates timelog templates", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: "11111111-1111-1111-1111-111111111111",
            title: "Focus",
            area_id: null,
            person_ids: [],
            persons: [],
            position: 0,
            usage_count: 0,
            created_at: "2026-06-17T12:00:00Z",
            updated_at: "2026-06-17T12:00:00Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await timelogTemplatesApi.create({
      title: "Focus",
      area_id: null,
      default_duration_minutes: 45,
    });
    await timelogTemplatesApi.update("11111111-1111-1111-1111-111111111111", {
      area_id: null,
      person_ids: [],
      default_duration_minutes: null,
    });

    const [createUrl, createInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(createUrl).toBe(localUrl(ENDPOINTS.TIMELOGS.TEMPLATES.BASE));
    expect(createInit.method).toBe("POST");
    expect(createInit.body).toBe(
      JSON.stringify({
        title: "Focus",
        area_id: null,
        default_duration_minutes: 45,
      }),
    );

    const [updateUrl, updateInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(updateUrl).toBe(
      localUrl(
        ENDPOINTS.TIMELOGS.TEMPLATES.BY_ID(
          "11111111-1111-1111-1111-111111111111",
        ),
      ),
    );
    expect(updateInit.method).toBe("PATCH");
    expect(updateInit.body).toBe(
      JSON.stringify({
        area_id: null,
        person_ids: [],
        default_duration_minutes: null,
      }),
    );
  });

  it("sends bulk create, reorder, delete, and usage requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await timelogTemplatesApi.bulkCreate([{ title: "Review" }]);
    await timelogTemplatesApi.reorder([
      { id: "11111111-1111-1111-1111-111111111111", position: 2 },
    ]);
    await timelogTemplatesApi.remove("11111111-1111-1111-1111-111111111111");
    await timelogTemplatesApi.bumpUsage("11111111-1111-1111-1111-111111111111");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(
      JSON.stringify({ items: [{ title: "Review" }] }),
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      localUrl(ENDPOINTS.TIMELOGS.TEMPLATES.BULK),
    );
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(
      JSON.stringify({
        items: [{ id: "11111111-1111-1111-1111-111111111111", position: 2 }],
      }),
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      localUrl(ENDPOINTS.TIMELOGS.TEMPLATES.REORDER),
    );
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
    expect(fetchMock.mock.calls[3][0]).toBe(
      localUrl(
        ENDPOINTS.TIMELOGS.TEMPLATES.BUMP_USAGE(
          "11111111-1111-1111-1111-111111111111",
        ),
      ),
    );
  });
});
