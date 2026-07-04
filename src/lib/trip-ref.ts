/**
 * Deterministic dossier reference. Derived from the trip's UUID and its
 * created_at date so the number is stable for the life of the trip and
 * survives reloads, unlike the previous client-side random.
 *
 * Format: TD-YYMMDD-XXXX
 *   YYMMDD → created_at (UTC) date, or today's date as fallback
 *   XXXX   → 4-digit decimal derived from the first 4 hex chars of the id
 */
export function tripRef(tripId?: string | null, createdAt?: string | null): string {
  const d = createdAt ? new Date(createdAt) : new Date();
  const safe = isNaN(d.getTime()) ? new Date() : d;
  const y = String(safe.getUTCFullYear()).slice(-2);
  const m = String(safe.getUTCMonth() + 1).padStart(2, "0");
  const day = String(safe.getUTCDate()).padStart(2, "0");

  let suffix = "0000";
  if (tripId) {
    const hex = tripId.replace(/-/g, "").slice(0, 4);
    const n = parseInt(hex, 16);
    if (!isNaN(n)) suffix = String((n % 9000) + 1000);
  }
  return `TD-${y}${m}${day}-${suffix}`;
}