import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/persons")({
  beforeLoad: () => {
    throw redirect({ to: "/people" });
  },
});
