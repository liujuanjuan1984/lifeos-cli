import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({
  t: vi.fn(
    (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
  ),
}));

import { ENDPOINTS } from "@/services/api/endpoints";
import { visionsApi } from "@/services/api/visions";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("visionsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs derived experience through the dedicated endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "vision-1",
          name: "Build focus",
          status: "active",
          stage: 1,
          experience_points: 120,
          experience_rate_per_hour: null,
          created_at: "2026-07-07T12:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await visionsApi.syncExperience("vision-1");

    expect(response.experience_rate_per_hour).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(localUrl(ENDPOINTS.VISIONS.SYNC_EXPERIENCE("vision-1")));
    expect(init.method).toBe("POST");
  });
});
