import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/habits")({
  component: lazyRouteComponent(() => import("@/pages/HabitsPage")),
});
