import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getGuide } from "@/content/guides";
import { getSkin } from "@/lib/skins/registry";
import { captureServer } from "@/lib/analytics.server";

function randomSuffix(len = 6) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Copies a guide's blocks into a fresh draft trip owned by `userId`. The guide
 * itself is immutable content — nothing here writes back to it.
 */
export async function cloneGuideForUser(slug: string, userId: string) {
  const guide = getGuide(slug);
  if (!guide || !guide.published || guide.blocks.length === 0) {
    throw new Error("Guide not available");
  }
  const skin = getSkin(guide.skinId) ?? getSkin("epictetus");
  if (!skin) throw new Error("Unknown template");

  const tripSlug = `${guide.slug}-${randomSuffix()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: trip, error } = await supabaseAdmin
    .from("trips")
    .insert({
      user_id: userId,
      destination: guide.destination,
      subtitle: guide.dek,
      template_id: skin.meta.id,
      slug: tripSlug,
      visibility: "unlisted",
      status: "draft",
      expires_at: expiresAt,
      content: { blocks: guide.blocks, skin: skin.meta.id },
    })
    .select("id, slug")
    .single();

  if (error) {
    console.error("[cloneGuide] insert failed", error);
    throw new Error("Failed to copy guide");
  }

  await captureServer("guide_clone_completed", userId, {
    slug: guide.slug,
    template_id: skin.meta.id,
    trip_slug: trip.slug,
  });

  return { tripId: trip.id as string, slug: trip.slug as string };
}
