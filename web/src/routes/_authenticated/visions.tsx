import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/visions")({
  component: lazyRouteComponent(() => import("@/pages/VisionsPage")),
});
