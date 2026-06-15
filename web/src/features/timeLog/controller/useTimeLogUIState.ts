import { useCallback } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { UUID } from "@/types/primitive";
import { SelectorSpecialValue } from "@/components/selects/selectorTypes";

/**
 * Persistent UI state for Timelog page
 * - sortOrder: "asc" | "desc"
 * - selectedAreaId: UUID | "" | "__none__" | null
 * - scrollPosition: number
 */
export function useTimeLogUIState() {
  // Sort order (default asc), persist until storage is cleared
  const { state: sortOrder, setState: setSortOrder } = usePersistentState<
    "asc" | "desc"
  >({
    key: "tt_sort_order",
    defaultValue: "asc",
    expireInHours: 0,
  });

  // Area filter (default all), expire in 48h
  const { state: selectedAreaId, setState: setSelectedAreaId } =
    usePersistentState<UUID | "" | null | typeof SelectorSpecialValue.None>({
      key: "tt_selected_area_id",
      defaultValue: "",
      expireInHours: 48,
    });

  // Scroll position (default 0), expire in 24h
  const { state: scrollPosition, setState: setScrollPosition } =
    usePersistentState<number>({
      key: "tt_scroll_position",
      defaultValue: 0,
      expireInHours: 24,
    });

  const saveScrollPosition = useCallback(
    (position: number) => setScrollPosition(position),
    [setScrollPosition],
  );

  const restoreScrollPosition = useCallback(() => {
    if (scrollPosition > 0) {
      window.scrollTo({
        top: scrollPosition,
        behavior: "auto",
      });
    }
  }, [scrollPosition]);

  const clearScrollPosition = useCallback(
    () => setScrollPosition(0),
    [setScrollPosition],
  );

  return {
    // state
    sortOrder,
    selectedAreaId,
    scrollPosition,

    // setters
    setSortOrder,
    setSelectedAreaId,
    setScrollPosition,

    // helpers
    saveScrollPosition,
    restoreScrollPosition,
    clearScrollPosition,
  };
}
