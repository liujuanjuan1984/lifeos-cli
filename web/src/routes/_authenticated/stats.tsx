import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/stats")({
  component: lazyRouteComponent(() => import("@/pages/InsightsPage")),
});
