import { createFileRoute } from "@tanstack/react-router";

/**
 * Cleanup hook for stuck `trip_doc_previews` rows.
 *
 * A row is created in `status = 'pending'` right after the Google Doc is
 * created but before the `batchUpdate` writes its contents. If the writer
 * dies (crash, network loss, worker timeout) the row stays `pending`
 * forever and the next export attempt with the same idempotency key
 * reuses the half-written doc.
 *
 * This endpoint sweeps any `pending` row older than the timeout
 * (default 10 minutes) into `status = 'failed'`. The export handler
 * already reuses the existing `google_doc_id` for any non-ready row and
 * now clears its content before re-writing, so retries on a `failed`
 * row resume cleanly without creating duplicate docs.
 *
 * Triggered by pg_cron every 5 minutes. Public endpoint — safe because
 * it only updates rows older than the threshold and returns counts.
 */

const TIMEOUT_MINUTES = 10;

export const Route = createFileRoute(
  "/api/public/hooks/cleanup-pending-doc-exports",
)({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const cutoff = new Date(
          Date.now() - TIMEOUT_MINUTES * 60_000,
        ).toISOString();

        const { data, error } = await supabaseAdmin
          .from("trip_doc_previews")
          .update({ status: "failed" })
          .eq("status", "pending")
          .lt("updated_at", cutoff)
          .select("id");

        if (error) {
          console.error("[cleanup-pending-doc-exports] failed", error);
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            timeoutMinutes: TIMEOUT_MINUTES,
            markedFailed: data?.length ?? 0,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});