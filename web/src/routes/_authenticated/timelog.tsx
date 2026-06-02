import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/timelog")({
  component: lazyRouteComponent(() => import("@/pages/TimeLogPage")),
});
