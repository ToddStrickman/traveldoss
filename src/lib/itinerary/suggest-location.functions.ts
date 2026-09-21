import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupPlaceFacts } from "@/lib/maps/place-lookup.server";

/**
 * Contextual location suggestion for the quick-add activity form.
 *
 * Uses the same keyless OpenStreetMap lookup as the coordinate backfill
 * (place-lookup.server.ts) — one ladder, no key, no bill. The query is
 * anchored to the neighbouring activity in the dossier ("dinner near Time Out
 * Market, Lisbon") so the pick lands in the right part of town. Still
 * auth-gated: these are outbound requests on a shared community service.
 */

const FETCH_TIMEOUT_MS = 4_000;

export type LocationSuggestion = { name: string; address: string };

export const suggestLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        activity: z.string().min(1).max(120),
        destination: z.string().max(120).optional(),
        /** Names of the activities before/after the empty slot, for locality. */
        prevActivity: z.string().max(160).optional(),
        nextActivity: z.string().max(160).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ suggestion: LocationSuggestion | null }> => {
    const anchor = data.prevActivity || data.nextActivity;
    const textQuery = [
      data.activity,
      anchor ? `near ${anchor}` : null,
      data.destination ?? null,
    ]
      .filter(Boolean)
      .join(", ");

    try {
      const facts = await lookupPlaceFacts(textQuery, { timeoutMs: FETCH_TIMEOUT_MS });
      const name = facts?.name?.trim();
      const address = facts?.address?.trim();
      if (!name && !address) return { suggestion: null };
      return { suggestion: { name: name ?? "", address: address ?? "" } };
    } catch {
      return { suggestion: null };
    }
  });
