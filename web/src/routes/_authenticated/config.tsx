import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/config")({
  component: lazyRouteComponent(() => import("@/pages/SettingsPage")),
});
