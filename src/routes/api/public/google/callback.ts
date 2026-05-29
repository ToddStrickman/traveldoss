import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleOAuthCallback } from "@/lib/google-oauth.server";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleGoogleOAuthCallback(request, "/api/public/google/callback"),
    },
  },
});