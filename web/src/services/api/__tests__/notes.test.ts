import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "@/services/api/endpoints";
import { notesApi } from "@/services/api/notes";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("notesApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads note tag and person usage into note stats", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith(localUrl(ENDPOINTS.NOTES.BASE))) {
        if (url === localUrl(ENDPOINTS.NOTES.STATS_PERSONS)) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                person_stats: [
                  {
                    id: "22222222-2222-2222-2222-222222222222",
                    name: "Alice",
                    display_name: "Alice",
                    usage_count: 1,
                  },
                ],
                total_persons: 1,
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [],
              pagination: { page: 1, size: 1, total: 3, pages: 3 },
              meta: {},
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            entity_type: "note",
            tag_stats: [
              {
                id: "11111111-1111-1111-1111-111111111111",
                usage_count: 2,
              },
            ],
            total_tags: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });

    const stats = await notesApi.getStats();

    expect(stats.total_notes).toBe(3);
    expect(stats.tag_stats).toEqual([
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "",
        usage_count: 2,
      },
    ]);
    expect(stats.person_stats).toEqual([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Alice",
        display_name: "Alice",
        usage_count: 1,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.some((url) => url.startsWith(localUrl(ENDPOINTS.NOTES.BASE)))).toBe(true);
    expect(requestedUrls).toContain(localUrl(ENDPOINTS.STATS.TAGS_USAGE("note")));
    expect(requestedUrls).toContain(localUrl(ENDPOINTS.NOTES.STATS_PERSONS));
  });

  it("queries notes through the habit_action_id filter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 1, size: 50, total: 0, pages: 0 },
          meta: { habit_action_id: "action-1" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await notesApi.fetchPaged({
      page: 1,
      size: 50,
      habit_action_id: "action-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.NOTES.BASE))).toBe(true);
    expect(parsedUrl.searchParams.get("habit_action_id")).toBe("action-1");
    expect(parsedUrl.searchParams.get("page")).toBe("1");
    expect(parsedUrl.searchParams.get("size")).toBe("50");
    expect(init.method).toBe("GET");
  });
});
