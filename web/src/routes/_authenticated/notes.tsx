import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notes")({
  component: lazyRouteComponent(() => import("@/pages/NotesPage")),
});
