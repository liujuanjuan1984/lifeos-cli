import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  loader: async () => {
    // LifeOS Web UI is served on the user's machine and does not require
    // cloud authentication or reference-data bootstrap.
  },
});
