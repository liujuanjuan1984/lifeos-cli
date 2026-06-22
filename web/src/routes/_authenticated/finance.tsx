import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance")({
  component: lazyRouteComponent(() => import("@/pages/FinancePage")),
});
