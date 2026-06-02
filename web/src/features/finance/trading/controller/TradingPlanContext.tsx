import { createContext, useContext } from "react";

import type { TradingPlanController } from "./useTradingPlanController";

export const TradingPlanContext = createContext<TradingPlanController | null>(
  null,
);

export function useTradingPlanContext() {
  const context = useContext(TradingPlanContext);
  if (!context) {
    throw new Error(
      "useTradingPlanContext must be used within TradingPlansPage",
    );
  }
  return context;
}
