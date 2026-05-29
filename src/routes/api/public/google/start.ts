import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleOAuthStart } from "@/lib/google-oauth.server";

export const Route = createFileRoute("/api/public/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleGoogleOAuthStart(
          request,
          "/api/public/google/start",
          "/api/public/google/callback",
        ),
    },
  },
});