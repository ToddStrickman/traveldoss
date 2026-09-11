/**
 * "Locate stops": the owner-triggered geocode pass for the Live Map.
 *
 * The save-time backfill only runs when a dossier is edited, and dossiers
 * minted before Live Map v2 lost their coordinates on every refine/harden
 * pass (now fixed by carry-over). A traveller who opens the map on such a
 * dossier used to see "nothing pinned" with no way forward. This server
 * function lets the owner (RLS decides who that is) run the same bounded
 * lookup on demand: up to LOCATE_CAP stops per call, shared cache first,
 * attempt cap honoured, result persisted, enriched blocks returned so the
 * map can redraw without a reload.
 */
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Block } from "@/lib/skins/types";
import { enrichBlocksWithCoords } from "@/lib/itinerary/geo.server";
import { summarizeLocate, type LocateSummary } from "@/lib/maps/locate-summary";

export const LOCATE_CAP = 24;

export type LocateResult = LocateSummary & {
  /** The persisted blocks after this call, or null when nothing changed. */
  blocks: Block[] | null;
};

export const locateTripPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(128),
        /** An explicit owner request may retry stops that hit the cap once. */
        retryNeedsReview: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<LocateResult> => {
    const { supabase, userId } = context;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // RLS: the user-scoped client only returns the caller's own trips.
    const { data: row, error } = await supabase
      .from("trips")
      .select("content, destination, updated_at")
      .eq("slug", data.slug)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Could not read the dossier: ${error.message}`);
    if (!row) throw new Error("Dossier not found, or you don't own it.");

    const content = (row.content ?? {}) as { blocks?: Block[]; skin?: string; meta?: unknown };
    const before = (content.blocks ?? []) as Block[];
    if (!apiKey) return { ...summarizeLocate(before, before, false), blocks: null };

    let serviceUnavailable = false;
    const after = await enrichBlocksWithCoords(before, {
      deps: { onServiceError: () => { serviceUnavailable = true; } },
      apiKey,
      destination: row.destination,
      budgetMs: 9_000,
      maxPerRun: LOCATE_CAP,
      retryNeedsReview: !!data.retryNeedsReview,
    });

    if (after !== before) {
      const { data: saved, error: writeError } = await supabase
        .from("trips")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ content: { ...content, blocks: after } as any })
        .eq("slug", data.slug)
        .eq("user_id", userId)
        .eq("updated_at", row.updated_at)
        .select("id");
      if (!writeError && !saved?.length) throw new Error("The itinerary changed while locating. Try again to use the latest stops.");
      if (writeError) throw new Error(`Could not save locations: ${writeError.message}`);
    }

    return { ...summarizeLocate(before, after, true), serviceUnavailable, blocks: after !== before ? after : null };
  });
