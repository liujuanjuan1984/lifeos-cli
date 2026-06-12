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
});
