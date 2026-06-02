import { useCallback, useEffect, useRef, useState } from "react";
import type { HoverTooltipOverlayPosition } from "@/components/HoverTooltipOverlay";

export interface TooltipOffset {
  x?: number;
  y?: number;
}

interface TooltipState<TPayload> {
  position: HoverTooltipOverlayPosition;
  offset?: TooltipOffset;
  payload: TPayload;
}

interface UseHoverTooltipOptions<TPayload> {
  defaultOffset?: TooltipOffset;
  focusOffset?:
    | TooltipOffset
    | ((rect: DOMRect, payload: TPayload) => TooltipOffset | undefined);
}

interface ShowTooltipOptions<TPayload> {
  payload: TPayload;
  position: HoverTooltipOverlayPosition;
  offset?: TooltipOffset;
}

/**
 * 提供统一的 tooltip 状态管理与事件调度封装，
 * 复用鼠标/键盘触发逻辑与 requestAnimationFrame 节流。
 */
export function useHoverTooltip<TPayload>(
  options: UseHoverTooltipOptions<TPayload> = {},
) {
  const { defaultOffset, focusOffset } = options;
  const [tooltipState, setTooltipState] =
    useState<TooltipState<TPayload> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cancelScheduledUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelScheduledUpdate();
    };
  }, [cancelScheduledUpdate]);

  const showTooltip = useCallback(
    ({ payload, position, offset }: ShowTooltipOptions<TPayload>) => {
      setTooltipState({
        payload,
        position,
        offset: offset ?? defaultOffset,
      });
    },
    [defaultOffset],
  );

  const schedulePositionUpdate = useCallback(
    (position: HoverTooltipOverlayPosition) => {
      cancelScheduledUpdate();
      animationFrameRef.current = requestAnimationFrame(() => {
        setTooltipState((current) =>
          current ? { ...current, position } : current,
        );
        animationFrameRef.current = null;
      });
    },
    [cancelScheduledUpdate],
  );

  const hideTooltip = useCallback(() => {
    cancelScheduledUpdate();
    setTooltipState(null);
  }, [cancelScheduledUpdate]);

  const showTooltipForElement = useCallback(
    (
      payload: TPayload,
      element: HTMLElement,
      fallbackOffset?: TooltipOffset,
    ) => {
      const rect = element.getBoundingClientRect();
      const resolvedFocusOffset =
        typeof focusOffset === "function"
          ? focusOffset(rect, payload)
          : focusOffset;

      showTooltip({
        payload,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
        offset: resolvedFocusOffset ?? fallbackOffset ?? defaultOffset,
      });
    },
    [defaultOffset, focusOffset, showTooltip],
  );

  return {
    tooltipState,
    showTooltip,
    schedulePositionUpdate,
    hideTooltip,
    showTooltipForElement,
  };
}
