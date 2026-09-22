import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { digest } from "@/lib/adaptive/crypto.server";
import { runAdaptiveJobs } from "@/lib/adaptive/worker.server";
export const Route = createFileRoute("/api/public/adaptive/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.ADAPTIVE_JOB_SECRET,
          supplied = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (
          !secret ||
          secret.length < 32 ||
          !supplied ||
          (await digest(secret)) !== (await digest(supplied))
        )
          return new Response("Unauthorized", { status: 401 });
        return Response.json(await runAdaptiveJobs(), { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
