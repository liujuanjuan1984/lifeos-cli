import React, { createContext, useContext } from "react";

export interface HeaderState {
  title?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
}

interface PageHeaderContextValue extends HeaderState {
  setHeader: (state: HeaderState) => void;
  clearHeader: () => void;
}

export const PageHeaderContext = createContext<PageHeaderContextValue | null>(
  null,
);

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx)
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  return ctx;
}
