import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSkin } from "@/lib/skins/registry";
import { projectPublicTrip, type PublicTripRow } from "@/lib/public-trip";

function randomSuffix(len = 6) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const listTemplatesPublic = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: true };
});

/**
 * Mints a new trip with the chosen skin (template_id).
 * v1 monetization (step 4) wraps this behind a $5 Stripe checkout —
 * for now it creates the trip directly so the gallery is navigable.
 */
export const pickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ templateId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const skin = getSkin(data.templateId);
    if (!skin) throw new Error("Unknown skin");

    const slug = `${skin.meta.id}-${randomSuffix()}`;
    // 30-day default expiry; refined once start/end dates are set.
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        destination: "Untitled Trip",
        subtitle: skin.meta.personality,
        tone: skin.meta.codename,
        template_id: skin.meta.id,
        original_template_id: skin.meta.id,
        slug,
        visibility: "unlisted",
        status: "draft",
        expires_at: expiresAt,
        // Ship the dossier empty so the BlankDayScaffold takes over from
        // the first render — every visitor to /t/<slug> already owns
        // their dossier; no second "mint" step required.
        content: { blocks: [], skin: skin.meta.id },
      })
      .select("id, slug")
      .single();
    if (error) {
      console.error("[pickTemplate] trip insert failed", error);
      throw new Error("Failed to create dossier");
    }

    return { tripId: trip.id, slug: trip.slug };
  });

export const getDossierBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    // Sensitive columns (user_id, visibility, status) are never selected:
    // this payload goes to every anonymous visitor. Owner detection is the
    // authed isTripOwner fn in trips.functions.ts.
    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .select(
        "id, slug, destination, subtitle, tone, template_id, hero_image_url, start_date, end_date, content, expires_at, created_at, user_id",
      )
      .eq("slug", data.slug)
      .neq("visibility", "private")
      .maybeSingle();
    if (error) {
      console.error("[getDossierBySlug] trip fetch failed", error);
      throw new Error("Failed to load dossier");
    }
    if (!trip) return { trip: null };

    // Access audit trail: every view of the public link is recorded
    // server-side (adblock-proof). It used to be awaited here, which put a
    // database write (and, for signed-in callers, an auth lookup) in front
    // of every anonymous page view. It is still recorded on the server and
    // still cannot be forged from the browser; it just finishes after the
    // response has gone out. user_id is used only for the owner flag and
    // never shipped.
    const { user_id: ownerUserId, ...publicRow } = trip;
    const [{ recordTripAccess, resolveOptionalActor }, { deferAfterResponse }] =
      await Promise.all([
        import("@/lib/access-log.server"),
        import("@/lib/request-context.server"),
      ]);
    deferAfterResponse(
      (async () => {
        await recordTripAccess({
          tripId: trip.id,
          tripSlug: trip.slug,
          eventType: "view",
          actorUserId: await resolveOptionalActor(),
          ownerUserId,
        });
      })(),
    );
    // Strips content/dates from expired trips — the re-publish gate must be
    // enforced here, not in the client render.
    return projectPublicTrip(publicRow as PublicTripRow);
  });