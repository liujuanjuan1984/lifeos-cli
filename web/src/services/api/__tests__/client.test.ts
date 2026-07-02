import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, http } from "@/services/api/client";
import { subscribeApiError } from "@/services/api/errorBus";

const localUrl = (path: string) => new URL(path, "http://localhost").toString();

describe("local web http client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds local absolute URLs and appends query parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await http.get("/api/v1/test", { page: 1, tag: ["a", "b"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost/api/v1/test?page=1&tag=a&tag=b");
    expect(init.method).toBe("GET");
  });

  it("sends JSON request bodies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "created" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await http.post("/api/v1/test", { title: "New item" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(localUrl("/api/v1/test"));
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ title: "New item" }));
  });

  it("returns undefined for no-content responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await expect(http.delete("/api/v1/test/1")).resolves.toBeUndefined();
  });

  it("uses FastAPI detail strings for errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(http.get("/api/v1/test")).rejects.toMatchObject({
      message: "Bad request",
      status: 400,
    });
  });

  it("emits ApiError instances for HTTP failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not found", { status: 404, statusText: "Not Found" }),
    );

    await expect(http.get("/api/v1/missing")).rejects.toBeInstanceOf(ApiError);
  });

  it("does not emit global errors for aborted requests", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeApiError(listener);
    const abortError = new Error("signal is aborted without reason");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError);

    await expect(http.get("/api/v1/test")).rejects.toBe(abortError);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
