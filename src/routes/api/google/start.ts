import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleOAuthStart } from "@/lib/google-oauth.server";

export const Route = createFileRoute("/api/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleGoogleOAuthStart(request, "/api/google/start", "/api/google/callback"),
    },
  },
});