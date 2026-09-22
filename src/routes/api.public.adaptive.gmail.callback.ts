import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { finishGmail } from "@/lib/adaptive/oauth.server";
export const Route = createFileRoute("/api/adaptive/gmail/callback")({
  server: { handlers: { GET: ({ request }) => finishGmail(request) } },
});
