import { z } from "zod";
import type { TripMeta } from "@/lib/skins/types";

/**
 * Dossier-level preferences (`trips.content.meta`) as accepted by
 * `updateDossier`.
 *
 * `hardenedAt` is not user content, but it MUST be in this schema: Zod v4
 * strips unknown keys, and the one-time background hardening pass persists
 * its "already done" marker through this exact save path. While the key was
 * missing the marker was silently dropped, so every dossier load re-ran the
 * most expensive operation in the product (three AI refine passes plus up to
 * 24 Google Places lookups, roughly $3). See `TripMeta` in skins/types.ts.
 */
export const DossierMetaSchema = z.object({
  travelers: z.string().max(80).optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  budget: z.enum(["shoestring", "moderate", "elevated", "luxury"]).optional(),
  interests: z.array(z.string().max(40)).max(20).optional(),
  hardenedAt: z.string().max(40).optional(),
});

export type DossierMetaInput = z.infer<typeof DossierMetaSchema>;

/**
 * Merge an incoming meta patch over what is already stored instead of
 * replacing it. The client always sends explicit values (clearing a field
 * sends `""`), so a key absent from the patch means "not touched", never
 * "delete". Replacing wholesale is how a partial save (the harden pass sends
 * only `{ hardenedAt }`) or a stale one could wipe sibling fields.
 */
export function mergeDossierMeta(prev: unknown, patch: DossierMetaInput): TripMeta {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as TripMeta) : {};
  return { ...base, ...patch };
}
