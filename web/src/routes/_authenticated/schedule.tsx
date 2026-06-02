import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/schedule")({
  component: lazyRouteComponent(() => import("@/pages/CalendarPage")),
});
