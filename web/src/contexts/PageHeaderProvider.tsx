import React, { useCallback, useMemo, useState } from "react";
import { PageHeaderContext, type HeaderState } from "./PageHeaderContext";

export function PageHeaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<HeaderState>({});
  const setHeaderCb = useCallback((s: HeaderState) => {
    setState((prev) => {
      const next = { ...prev, ...s };
      const sameTitle = prev.title === next.title;
      const sameSubtitle = prev.subtitle === next.subtitle;
      const sameActions = prev.actions === next.actions;
      const sameExtra = prev.extra === next.extra;
      if (sameTitle && sameSubtitle && sameActions && sameExtra) {
        return prev;
      }
      return next;
    });
  }, []);
  const clearHeaderCb = useCallback(() => {
    setState((prev) => {
      if (!prev.title && !prev.subtitle && !prev.actions && !prev.extra) {
        return prev;
      }
      return {};
    });
  }, []);
  const value = useMemo(
    () => ({
      ...state,
      setHeader: setHeaderCb,
      clearHeader: clearHeaderCb,
    }),
    [state, setHeaderCb, clearHeaderCb],
  );
  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  );
}
