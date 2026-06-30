import { beforeEach, describe, expect, it, vi } from "vitest";

import { ENDPOINTS } from "@/services/api/endpoints";
import { tagsApi } from "@/services/api/tags";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("tagsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates tags through the LifeOS Web API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "11111111-1111-1111-1111-111111111111",
          name: "project",
          entity_type: "note",
          category: "general",
          description: null,
          color: null,
          created_at: "2026-06-01T13:00:00+00:00",
          updated_at: "2026-06-01T13:00:00+00:00",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const created = await tagsApi.create({
      name: "Project",
      entity_type: "note",
      category: "general",
    });

    expect(created.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(localUrl(ENDPOINTS.TAGS.BASE));
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Project",
      entity_type: "note",
      category: "general",
    });
  });

  it("lists selector tags with a slim fields mode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 1, size: 1000, total: 0, pages: 0 },
          meta: { entity_type: "note", fields: "selector" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await tagsApi.getAll({
      entity_type: "note",
      page: 1,
      size: 1000,
      fields: "selector",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);
    expect(url.startsWith(localUrl(ENDPOINTS.TAGS.BASE))).toBe(true);
    expect(parsedUrl.searchParams.get("entity_type")).toBe("note");
    expect(parsedUrl.searchParams.get("page")).toBe("1");
    expect(parsedUrl.searchParams.get("size")).toBe("1000");
    expect(parsedUrl.searchParams.get("fields")).toBe("selector");
    expect(init.method).toBe("GET");
  });

  it("creates tag categories with the scoped entity type", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: "close_circle",
          label: "Close Circle",
          entity_type: "person",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const created = await tagsApi.createCategory(
      { label: "Close Circle" },
      "person",
    );

    expect(created.value).toBe("close_circle");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${localUrl(ENDPOINTS.TAGS.CATEGORIES)}?entity_type=person`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ label: "Close Circle" });
  });

  it("renames tag categories with the scoped entity type", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: "close_circle",
          label: "Close Circle",
          entity_type: "person",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const updated = await tagsApi.renameCategory(
      "relationship",
      { label: "Close Circle" },
      "person",
    );

    expect(updated.value).toBe("close_circle");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${localUrl(ENDPOINTS.TAGS.CATEGORY_BY_VALUE("relationship"))}?entity_type=person`,
    );
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ label: "Close Circle" });
  });

  it("moves selected tags to another category", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          updated_count: 1,
          failed_ids: [],
          errors: [],
          updated_tags: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await tagsApi.bulkUpdateCategories({
      ids: ["11111111-1111-1111-1111-111111111111"],
      category: "relationship",
    });

    expect(response.updated_count).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(localUrl(ENDPOINTS.TAGS.BATCH_UPDATE));
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      ids: ["11111111-1111-1111-1111-111111111111"],
      category: "relationship",
    });
  });

  it("loads single tag usage through the LifeOS Web API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_id: "11111111-1111-1111-1111-111111111111",
          tag_name: "mentor",
          entity_type: "person",
          category: "relationship",
          usage_by_entity_type: { person: 12 },
          total_usage: 12,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await tagsApi.getUsage(
      "11111111-1111-1111-1111-111111111111",
    );

    expect(response.total_usage).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      localUrl(ENDPOINTS.TAGS.USAGE("11111111-1111-1111-1111-111111111111")),
    );
    expect(init.method).toBe("GET");
  });

  it("loads batch tag usage by entity type through stats", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          entity_type: "person",
          tag_stats: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              usage_count: 12,
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

    const response = await tagsApi.getStatsBatch("person");

    expect(response.tag_stats[0].usage_count).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(localUrl(ENDPOINTS.STATS.TAGS_USAGE("person")));
    expect(init.method).toBe("GET");
  });
});
