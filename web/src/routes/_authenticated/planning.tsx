import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/planning")({
  component: lazyRouteComponent(() => import("@/pages/PlanningPage")),
});
