import { useEffect } from "react";

/**
 * useEscapeToClose
 *
 * Adds a global Escape key listener while the modal/dialog is open.
 * When Escape is pressed, it calls onClose unless disabled.
 */
export function useEscapeToClose(
  isOpen: boolean,
  onClose: () => void,
  options?: { disabled?: boolean; useCapture?: boolean },
) {
  const { disabled = false, useCapture = false } = options || {};

  useEffect(() => {
    if (!isOpen || disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // If an inner widget already handled ESC, respect it
      if ((event as unknown as { defaultPrevented?: boolean }).defaultPrevented)
        return;

      onClose();
      // Only stop propagation when we actually close to avoid interfering with inner widgets
      event.stopPropagation();
    };

    document.addEventListener("keydown", handleKeyDown, useCapture);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, useCapture);
    };
  }, [isOpen, disabled, onClose, useCapture]);
}
