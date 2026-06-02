import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAgentStreaming } from "@/features/agent/controller/useAgentStreaming";

describe("useAgentStreaming", () => {
  it("starts and aborts streaming sessions", () => {
    const { result } = renderHook(() =>
      useAgentStreaming({ stallTimeoutMs: 1000 }),
    );

    let controller: AbortController | undefined;
    act(() => {
      controller = result.current.startStreaming();
    });

    expect(result.current.phase).toBe("streaming");
    expect(controller).toBeTruthy();
    const currentController = controller;
    if (!currentController) {
      throw new Error("Failed to start streaming controller");
    }
    expect(currentController.signal.aborted).toBe(false);

    act(() => {
      result.current.abortStreaming("stalled", "stalled");
    });

    expect(result.current.abortReason).toBe("stalled");
    expect(currentController.signal.aborted).toBe(true);
    expect(result.current.phase).toBe("stalled");

    act(() => {
      result.current.completeStreaming();
    });

    expect(result.current.phase).toBe("idle");
  });

  it("invokes stall handler when no heartbeat is recorded", () => {
    vi.useFakeTimers();
    const stallHandler = vi.fn(({ abort }) => abort("timeout", "stalled"));

    const { result } = renderHook(() =>
      useAgentStreaming({ stallTimeoutMs: 1000, onStall: stallHandler }),
    );

    act(() => {
      result.current.startStreaming();
    });

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(stallHandler).toHaveBeenCalledTimes(1);
    expect(result.current.abortReason).toBe("timeout");
    expect(result.current.phase).toBe("stalled");

    vi.useRealTimers();
  });

  it("resets stall timer when activity is registered", () => {
    vi.useFakeTimers();
    const stallHandler = vi.fn();

    const { result } = renderHook(() =>
      useAgentStreaming({ stallTimeoutMs: 1000, onStall: stallHandler }),
    );

    act(() => {
      result.current.startStreaming();
    });

    act(() => {
      vi.advanceTimersByTime(600);
      result.current.registerStreamActivity();
      vi.advanceTimersByTime(700);
    });

    expect(stallHandler).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(stallHandler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
