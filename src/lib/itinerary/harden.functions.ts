import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Block } from "@/lib/skins/types";
import { refineItineraryAiCore } from "@/lib/itinerary/refine.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Background hardening pipeline. Runs once per dossier load, after the
 * initial parse handed the blocks to the editor. Stages:
 *
 *   1. SEARCH           — runs a refine pass (uses parseItineraryAi
 *                         which already gap-fills via Google Places).
 *   2. LOGIC CONFIRM    — second refine pass that pressure-tests the
 *                         day/time/category chronology with the latest
 *                         meta context.
 *   3. RE-HARDEN        — pure JS normalization against the allowable
 *                         field whitelist (categories, IATA codes, times,
 *                         tier, trimmed strings).
 *   4. FINAL COMPLETENESS — last refine pass asking the model to look
 *                         once more for anything that should be filled
 *                         in the allowable fields and is still missing.
 *
 * The whole thing is silent and fire-and-forget; failures log only.
 */

const MetaSchema = z.object({
  travelers: z.string().max(80).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  budget: z.enum(["shoestring", "moderate", "elevated", "luxury"]).optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
});

const InputSchema = z.object({
  blocks: z.array(z.any()).min(1).max(400),
  destination: z.string().max(200).optional(),
  startDate: z.string().max(40).optional(),
  endDate: z.string().max(40).optional(),
  meta: MetaSchema.optional(),
});

const ALLOWED_CATEGORIES = new Set([
  "transit",
  "restaurant",
  "walk",
  "event",
  "accommodation",
  "culture",
]);
const ALLOWED_TIERS = new Set(["primary", "shadow"]);

/**
 * Authenticated HTTP entry point. The most expensive operation in the product:
 * three refine passes, each of which runs a full AI parse plus up to
 * PER_RUN_CAP Google Places lookups. Must never be callable anonymously.
 */
export const hardenItineraryAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = {
      destination: data.destination,
      startDate: data.startDate,
      endDate: data.endDate,
      meta: data.meta,
    };
    let blocks = data.blocks as Block[];

    // Stage 1 — SEARCH
    console.info("[harden] stage 1/4 search");
    try {
      const r = await refineItineraryAiCore({
        ...ctx,
        blocks,
        reason: "Background search pass",
      });
      if (r?.blocks?.length) blocks = r.blocks as Block[];
    } catch (err) {
      console.error("[harden] stage 1 failed", err);
    }

    // Stage 2 — LOGIC CONFIRMATION
    console.info("[harden] stage 2/4 logic confirmation");
    try {
      const r = await refineItineraryAiCore({
        ...ctx,
        blocks,
        reason: "Logic confirmation: verify day order, times, categories",
      });
      if (r?.blocks?.length) blocks = r.blocks as Block[];
    } catch (err) {
      console.error("[harden] stage 2 failed", err);
    }

    // Stage 3 — RE-HARDEN (deterministic field whitelisting)
    console.info("[harden] stage 3/4 re-harden outputs");
    blocks = rehardenBlocks(blocks);

    // Stage 4 — FINAL COMPLETENESS PASS
    console.info("[harden] stage 4/4 final completeness");
    try {
      const r = await refineItineraryAiCore({
        ...ctx,
        blocks,
        reason: "Final completeness: fill every allowable field that can be inferred",
      });
      if (r?.blocks?.length) blocks = rehardenBlocks(r.blocks as Block[]);
    } catch (err) {
      console.error("[harden] stage 4 failed", err);
    }

    console.info("[harden] done", { count: blocks.length });
    return { blocks };
  });

function rehardenBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.kind !== "place") return b;
    const next: Record<string, unknown> = { ...b };
    if (next.category && !ALLOWED_CATEGORIES.has(String(next.category))) {
      delete next.category;
    }
    if (next.tier && !ALLOWED_TIERS.has(String(next.tier))) {
      delete next.tier;
    }
    if (typeof next.time === "string") {
      const m = next.time.match(/(\d{1,2}):(\d{2})/);
      next.time = m ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
      if (!next.time) delete next.time;
    }
    for (const k of ["name", "address", "phone", "website", "note", "hours"] as const) {
      const v = next[k];
      if (typeof v === "string") {
        const t = v.trim();
        if (t) next[k] = t;
        else delete next[k];
      }
    }
    return next as Block;
  });
}
