import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ACCESS_EVENT_TYPES = ["view", "export_pdf", "export_ics", "export_gdoc"] as const;

export type TripAccessEventRow = {
  id: string;
  event_type: (typeof ACCESS_EVENT_TYPES)[number];
  occurred_at: string;
  is_owner: boolean;
  actor_user_id: string | null;
  actor_label: string;
  visitor_hash: string | null;
};

/**
 * Records an export of a public dossier. Deliberately unauthenticated —
 * anyone holding the link can print or download it, and those accesses are
 * exactly what the owner's audit trail must show. The actor is resolved
 * server-side from the bearer token when the visitor is signed in; nothing
 * about the actor is trusted from the request body.
 */
export const logTripExport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(128),
        eventType: z.enum(["export_pdf", "export_ics", "export_gdoc"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordTripAccess, resolveOptionalActor } = await import("@/lib/access-log.server");
    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("id, user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!trip) return { ok: false as const };
    await recordTripAccess({
      tripId: trip.id,
      tripSlug: data.slug,
      eventType: data.eventType,
      actorUserId: await resolveOptionalActor(),
      ownerUserId: trip.user_id,
    });
    return { ok: true as const };
  });

/** The owner's audit trail for one dossier. RLS restricts rows to their trips. */
export const listTripAccessEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1).max(128), limit: z.number().int().min(1).max(200).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ events: TripAccessEventRow[] }> => {
    const { data: trip, error: tripError } = await context.supabase
      .from("trips")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (tripError) throw new Error(tripError.message);
    if (!trip) return { events: [] };

    const { data: rows, error } = await context.supabase
      .from("trip_access_events")
      .select("id, event_type, occurred_at, is_owner, actor_user_id, visitor_hash")
      .eq("trip_id", trip.id)
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);

    const events = (rows ?? []).map((r) => ({
      id: r.id,
      event_type: r.event_type as TripAccessEventRow["event_type"],
      occurred_at: r.occurred_at,
      is_owner: r.is_owner,
      actor_user_id: r.actor_user_id,
      // No emails or names: signed-in visitors show as an account, anonymous
      // ones as a stable per-link visitor code.
      actor_label: r.is_owner
        ? "You"
        : r.actor_user_id
          ? `Signed-in visitor ${r.actor_user_id.slice(0, 6)}`
          : `Visitor ${(r.visitor_hash ?? "unknown").slice(0, 6)}`,
      visitor_hash: r.visitor_hash,
    }));
    return { events };
  });
