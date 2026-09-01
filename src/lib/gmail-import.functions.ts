import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Google Doc previews attached to a trip.
 *
 * Each row in `trip_doc_previews` is a Doc generated for a trip (today only by
 * the export pipeline in `itinerary/export.functions.ts`) and is surfaced in
 * the dossier as an embedded iframe.
 *
 * The Gmail-import server fns that used to live here (`listBookingEmails`,
 * `importBookingEmail`) were removed in the 2026-08-31 hardening pass: they
 * read a single *workspace-owned* inbox through a shared connector key and
 * handed its contents to any signed-in app user. Per-user auto-ingest returns
 * on a per-user foundation (forwarding address first); it does not reuse this
 * code.
 */

export const listTripDocPreviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("trip_doc_previews")
      .select("id, google_doc_id, google_doc_url, source, source_message_id, status, created_at")
      .eq("trip_id", data.tripId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { previews: rows ?? [] };
  });
