import React, { useCallback, useMemo, useRef, useState } from "react";
import { ModalStackContext } from "./ModalStackContext";

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stack, setStack] = useState<string[]>([]);
  const originalOverflowRef = useRef<string | null>(null);

  const register = useCallback((id: string) => {
    setStack((prev) => {
      const next = [...prev, id];
      if (prev.length === 0) {
        // acquire scroll lock
        originalOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setStack((prev) => {
      const next = prev.filter((x) => x !== id);
      if (next.length === 0 && prev.length > 0) {
        // release scroll lock
        document.body.style.overflow = originalOverflowRef.current || "";
        originalOverflowRef.current = null;
      }
      return next;
    });
  }, []);

  const isTop = useCallback(
    (id: string) => stack[stack.length - 1] === id,
    [stack],
  );
  const getCount = useCallback(() => stack.length, [stack]);

  const value = useMemo(
    () => ({ register, unregister, isTop, getCount }),
    [register, unregister, isTop, getCount],
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
};
