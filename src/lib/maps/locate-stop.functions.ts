/**
 * Single-stop location lookup — the "Find this place" button in the stop editor.
 *
 * `locateTripPlaces` is the bulk pass over a whole dossier. This is its
 * one-stop sibling: the owner has just corrected an address and wants that
 * stop resolved now, without waiting for a save-time backfill or a 24-stop run.
 *
 * It reuses `resolveGeocodeQuery`, so the shared cache, the keyless Photon →
 * Nominatim ladder and the never-cache-a-fault rule all apply unchanged. It
 * writes nothing: the caller patches the block, which keeps the manual fix on
 * the normal autosave path.
 *
 * Auth is required so this is never an open geocoding proxy.
 */
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveGeocodeQuery } from "@/lib/itinerary/geo.server";

export type LocateStopResult =
  | { status: "found"; lat: number; lng: number; provider: string; query: string }
  | { status: "not_found"; query: string }
  /** A provider fault: our problem, not a bad address. Never cached, never counted. */
  | { status: "unavailable"; query: string };

export const locateOneStop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().max(240).optional(),
        address: z.string().max(400).optional(),
        destination: z.string().max(240).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LocateStopResult> => {
    const name = data.name?.trim();
    const address = data.address?.trim();
    const destination = data.destination?.trim();

    // Same query shape as the bulk pass: address is the strongest signal.
    const query = address
      ? [name, address].filter(Boolean).join(", ")
      : name && destination
        ? `${name}, ${destination}`
        : name || "";
    if (!query) return { status: "not_found", query: "" };

    const { hit, fault, provider } = await resolveGeocodeQuery(query);
    if (fault) return { status: "unavailable", query };
    if (!hit) return { status: "not_found", query };
    return { status: "found", lat: hit.lat, lng: hit.lng, provider, query };
  });
