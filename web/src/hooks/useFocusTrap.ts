import { useEffect } from "react";

/**
 * useFocusTrap
 *
 * Simple focus trap within a container. Cycles focus with Tab/Shift+Tab
 * without automatically focusing any element on open.
 */
export function useFocusTrap(
  isActive: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!isActive) return;
    const root = containerRef.current;
    if (!root) return;

    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
        (el) => !el.hasAttribute("aria-hidden"),
      );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [isActive, containerRef]);
}
