/**
 * Projection for the PUBLIC dossier payload (`getDossierBySlug`). Two rules,
 * both audit findings:
 *
 * 1. Expired trips must not ship their content: the $5 re-publish gate was
 *    purely cosmetic — the loader returned the full blocks blob and any
 *    visitor could read it from the payload. Expired responses carry only
 *    what the expired page and social <head> need.
 * 2. This is also the single place that decides expiry, so the client and
 *    server can't disagree about it.
 *
 * (`user_id`, `visibility`, and `status` are simply never selected — owner
 * detection goes through the authed `isTripOwner` server fn instead of
 * shipping the owner's UUID to every anonymous visitor.)
 */

export type PublicTripRow = {
  id: string;
  slug: string;
  destination: string;
  subtitle: string | null;
  template_id: string | null;
  hero_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any> | null;
  expires_at: string | null;
  created_at: string | null;
};

export function projectPublicTrip(
  row: PublicTripRow,
  now: number = Date.now(),
): { trip: PublicTripRow; expired: boolean } {
  const expired = row.expires_at
    ? new Date(row.expires_at).getTime() < now
    : false;
  if (!expired) return { trip: row, expired };
  return {
    expired,
    trip: {
      ...row,
      // The gated goods: itinerary content and trip dates stay server-side
      // until the owner re-publishes.
      content: null,
      start_date: null,
      end_date: null,
    },
  };
}
