import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/people")({
  component: lazyRouteComponent(() => import("@/pages/PersonsPage")),
});
