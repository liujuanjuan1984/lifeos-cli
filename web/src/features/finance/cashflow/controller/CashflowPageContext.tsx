import { createContext, useContext } from "react";

import type { CashflowPageController } from "./useCashflowPageController";

export const CashflowPageContext = createContext<CashflowPageController | null>(
  null,
);

export function useCashflowPageContext() {
  const context = useContext(CashflowPageContext);
  if (!context) {
    throw new Error("useCashflowPageContext must be used within CashflowPage");
  }
  return context;
}
