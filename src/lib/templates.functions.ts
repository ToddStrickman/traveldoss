import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSkin } from "@/lib/skins/registry";
import { DEMO_BLOCKS } from "@/lib/skins/demo";

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
 * v1 monetization (step 4) wraps this behind a $1 Stripe checkout —
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
        destination: "Sample Trip",
        subtitle: skin.meta.personality,
        tone: skin.meta.codename,
        template_id: skin.meta.id,
        original_template_id: skin.meta.id,
        slug,
        visibility: "unlisted",
        status: "draft",
        expires_at: expiresAt,
        content: { blocks: DEMO_BLOCKS, skin: skin.meta.id },
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
    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .select(
        "id, slug, destination, subtitle, tone, template_id, hero_image_url, start_date, end_date, content, visibility, status, expires_at, user_id",
      )
      .eq("slug", data.slug)
      .neq("visibility", "private")
      .maybeSingle();
    if (error) {
      console.error("[getDossierBySlug] trip fetch failed", error);
      throw new Error("Failed to load dossier");
    }
    if (!trip) return { trip: null };
    const expired = trip.expires_at ? new Date(trip.expires_at).getTime() < Date.now() : false;
    return { trip, expired };
  });