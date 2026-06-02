import { createContext, useContext } from "react";

import type { BalanceSheetController } from "./useBalanceSheetController";

export const BalanceSheetContext = createContext<BalanceSheetController | null>(
  null,
);

export function useBalanceSheetContext() {
  const context = useContext(BalanceSheetContext);
  if (!context) {
    throw new Error(
      "useBalanceSheetContext must be used within BalanceSheetPage",
    );
  }
  return context;
}
