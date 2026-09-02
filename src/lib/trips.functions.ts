import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PublicTripRow } from "@/lib/public-trip";
import { getSkin } from "@/lib/skins/registry";
import { enrichBlocksWithLinkTitles } from "@/lib/itinerary/link-titles.server";
import { enrichBlocksWithCoords } from "@/lib/itinerary/geo.server";
import type { Block } from "@/lib/skins/types";
import { DossierMetaSchema, mergeDossierMeta } from "@/lib/dossier-meta";
import { captureServer } from "@/lib/analytics.server";

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
        /** ISO yyyy-mm-dd from the generator's deterministic date resolution. */
        startDate: z.string().max(40).optional(),
        endDate: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const skin = getSkin(data.templateId);
    if (!skin) throw new Error("Unknown template");
    const slug = `${skin.meta.id}-${randomSuffix()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const destination = data.destination?.trim() || "Sample Trip";
    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        destination,
        subtitle: skin.meta.personality,
        template_id: skin.meta.id,
        slug,
        visibility: "unlisted",
        status: "draft",
        expires_at: expiresAt,
        ...(data.startDate ? { start_date: data.startDate } : {}),
        ...(data.endDate ? { end_date: data.endDate } : {}),
        content: {
          // Best-effort, bounded enrichment: raw URLs become titled links and
          // address-only stops gain coordinates for the Live Map. Anything
          // unresolved is picked up by the next autosave.
          blocks: await enrichBlocksWithCoords(
            await enrichBlocksWithLinkTitles(data.blocks as Block[], { budgetMs: 5_000 }),
            { budgetMs: 4_000, destination },
          ),
          skin: skin.meta.id,
        },
      })
      .select("id, slug")
      .single();
    if (error) {
      console.error("[createTripFromIngestion] insert failed", error);
      throw new Error("Failed to create dossier");
    }
    // Lifecycle transition: captured server-side so it is never trusted from
    // the client. Counts only, and the trip id rather than the capability slug.
    await captureServer("mint_completed", userId, {
      template_id: skin.meta.id,
      trip_id: trip.id,
      block_count: (data.blocks as Block[]).length,
      day_count: (data.blocks as Block[]).filter(
        (b) => (b as { kind?: string }).kind === "day",
      ).length,
      source: "server",
    });
    return { tripId: trip.id, slug: trip.slug };
  });

/**
 * Owner check for a public dossier view. RLS-scoped: the select only sees
 * rows the caller owns, so a hit means ownership. Exists so the public
 * getDossierBySlug payload never has to ship the owner's user_id.
 */
export const isTripOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trips")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isOwner: !!row };
  });

/**
 * The owner's own dossier, bypassing the public expiry gate. RLS-scoped:
 * the select only sees rows the caller owns, so anonymous visitors and
 * other accounts never reach the ungated payload — they keep getting the
 * stripped expired projection from getDossierBySlug. Exists so expiry
 * darkens the public link without ever locking the owner out of their
 * own itinerary.
 */
export const getOwnDossierBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trips")
      .select(
        "id, slug, destination, subtitle, template_id, hero_image_url, start_date, end_date, content, expires_at, created_at",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { trip: (row ?? null) as PublicTripRow | null };
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
        meta: DossierMetaSchema.optional(),
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
      const { data: existing, error: readError } = await supabase
        .from("trips")
        .select("content, destination")
        .eq("slug", data.slug)
        .single();
      // A failed read must fail the save: merging into `{}` would silently
      // drop the sibling keys (skin/meta) we exist to preserve.
      if (readError) throw new Error(`Save failed reading the trip: ${readError.message}`);
      const prev = (existing?.content ?? {}) as {
        blocks?: unknown;
        skin?: string;
        meta?: unknown;
      };
      patch.content = {
        ...prev,
        // Backfill on every save: raw URLs gain stored human titles and
        // coordinate-less stops gain lat/lng for the Live Map (bounded;
        // failures retried next save).
        ...(data.blocks !== undefined
          ? {
              blocks: await enrichBlocksWithCoords(
                await enrichBlocksWithLinkTitles(data.blocks as Block[], { budgetMs: 3_000 }),
                {
                  budgetMs: 2_500,
                  destination:
                    data.destination ??
                    (existing as { destination?: string } | null)?.destination ??
                    null,
                },
              ),
            }
          : {}),
        // Merge, never replace: a marker-only save from the harden pass must
        // not wipe travelers/pace, and a user save must not wipe the marker.
        ...(data.meta !== undefined ? { meta: mergeDossierMeta(prev.meta, data.meta) } : {}),
        ...(data.templateId !== undefined ? { skin: data.templateId } : {}),
      };
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await supabase
      .from("trips")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("slug", data.slug)
      .select("id");
    if (error) throw new Error(error.message);
    // RLS filters rows it rejects instead of erroring: an update that
    // matched zero rows was REJECTED (wrong owner / unknown slug), not
    // saved. Returning ok here is how phantom "Saved" states happen.
    if (!updated?.length) {
      throw new Error("Save rejected — this account can't edit this trip.");
    }
    return { ok: true, savedAt: new Date().toISOString() };
  });