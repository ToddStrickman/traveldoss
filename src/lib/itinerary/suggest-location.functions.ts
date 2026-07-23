import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Contextual location suggestion for the quick-add activity form.
 *
 * Reuses the same Places Text Search + GOOGLE_MAPS_API_KEY as the
 * coordinate backfill (geo.server.ts) — one provider, one bill. The query
 * is anchored to the neighbouring activity in the dossier ("dinner near
 * Time Out Market, Lisbon") so the pick lands in the right part of town.
 * Auth-gated for cost control; missing key degrades to no suggestion.
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
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { suggestion: null };

    const anchor = data.prevActivity || data.nextActivity;
    const textQuery = [
      data.activity,
      anchor ? `near ${anchor}` : null,
      data.destination ?? null,
    ]
      .filter(Boolean)
      .join(", ");

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress",
          },
          body: JSON.stringify({ textQuery, pageSize: 1 }),
        });
        if (!res.ok) return { suggestion: null };
        const json = (await res.json()) as {
          places?: Array<{
            displayName?: { text?: string };
            formattedAddress?: string;
          }>;
        };
        const place = json.places?.[0];
        const name = place?.displayName?.text?.trim();
        const address = place?.formattedAddress?.trim();
        if (!name && !address) return { suggestion: null };
        return { suggestion: { name: name ?? "", address: address ?? "" } };
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return { suggestion: null };
    }
  });
