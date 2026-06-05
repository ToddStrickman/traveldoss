import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSkin } from "@/lib/skins/registry";

function randomSuffix(len = 6) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("trips")
      .select("id, slug, destination, start_date, end_date, status, hero_image_url, last_synced_at:updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { trips: data ?? [] };
  });

/** Mint a new trip from parsed ingestion blocks in a chosen template. */
export const createTripFromIngestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        templateId: z.string().min(1).max(64),
        blocks: z.array(z.any()).min(1).max(2000),
        destination: z.string().min(1).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const skin = getSkin(data.templateId);
    if (!skin) throw new Error("Unknown template");
    const slug = `${skin.meta.id}-${randomSuffix()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const destination = data.destination?.trim() || "Untitled Trip";
    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        destination,
        subtitle: skin.meta.personality,
        tone: skin.meta.codename,
        template_id: skin.meta.id,
        original_template_id: skin.meta.id,
        slug,
        visibility: "unlisted",
        status: "draft",
        expires_at: expiresAt,
        content: { blocks: data.blocks, skin: skin.meta.id },
      })
      .select("id, slug")
      .single();
    if (error) {
      console.error("[createTripFromIngestion] insert failed", error);
      throw new Error("Failed to create dossier");
    }
    return { tripId: trip.id, slug: trip.slug };
  });

/** Update an existing dossier (autosave). Owner only via RLS. */
export const updateDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        slug: z.string().min(1).max(128),
        blocks: z.array(z.any()).optional(),
        templateId: z.string().min(1).max(64).optional(),
        destination: z.string().min(1).max(120).optional(),
        subtitle: z.string().max(280).optional(),
        startDate: z.string().max(40).optional(),
        endDate: z.string().max(40).optional(),
        meta: z
          .object({
            travelers: z.string().max(80).optional(),
            pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
            budget: z
              .enum(["shoestring", "moderate", "elevated", "luxury"])
              .optional(),
            interests: z.array(z.string().max(40)).max(20).optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: {
      destination?: string;
      subtitle?: string;
      template_id?: string;
      start_date?: string | null;
      end_date?: string | null;
      content?: unknown;
    } = {};
    if (data.destination !== undefined) patch.destination = data.destination;
    if (data.subtitle !== undefined) patch.subtitle = data.subtitle;
    if (data.templateId !== undefined) patch.template_id = data.templateId;
    if (data.startDate !== undefined)
      patch.start_date = data.startDate.trim() ? data.startDate : null;
    if (data.endDate !== undefined)
      patch.end_date = data.endDate.trim() ? data.endDate : null;
    if (data.blocks !== undefined || data.meta !== undefined) {
      // Merge into the existing content blob so we don't clobber sibling
      // keys (blocks vs meta). Read-then-write is racy but acceptable for
      // the autosave cadence here.
      const { data: existing } = await supabase
        .from("trips")
        .select("content")
        .eq("slug", data.slug)
        .single();
      const prev = (existing?.content ?? {}) as {
        blocks?: unknown;
        skin?: string;
        meta?: unknown;
      };
      patch.content = {
        ...prev,
        ...(data.blocks !== undefined ? { blocks: data.blocks } : {}),
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
        ...(data.templateId !== undefined ? { skin: data.templateId } : {}),
      };
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("trips").update(patch as any).eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true, savedAt: new Date().toISOString() };
  });