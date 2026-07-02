import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({
  t: vi.fn(
    (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
  ),
}));

import { ENDPOINTS } from "@/services/api/endpoints";
import { tasksApi } from "@/services/api/tasks";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("tasksApi.updateStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the dedicated PATCH status endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "task-1", status: "done" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await tasksApi.updateStatus("task-1", "done");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(localUrl(ENDPOINTS.TASKS.STATUS("task-1")));
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ status: "done" }));
  });
});

describe("tasksApi.getTimelogs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queries timelogs through the task_id filter", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: "timelog-1", title: "Focus" }],
          pagination: { page: 2, size: 10, total: 1, pages: 1 },
          meta: { task_id: "task-1" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await tasksApi.getTimelogs("task-1", 2, 10);

    expect(response.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      localUrl(`${ENDPOINTS.TIMELOGS.BASE}?task_id=task-1&page=2&size=10`),
    );
    expect(init.method).toBe("GET");
  });
});
