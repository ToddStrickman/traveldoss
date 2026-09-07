/**
 * Evergreen dossiers (admin-only).
 *
 * A dossier expires when `trips.expires_at` is in the past; a NULL means "never
 * expires" (see `projectPublicTrip`). Marking a dossier evergreen therefore just
 * clears that column — no new state to keep in sync. Reverting hands the dossier
 * a fresh 30-day publishing window, the same window a mint grants.
 */

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EvergreenTrip = {
  id: string;
  slug: string;
  destination: string;
  expiresAt: string | null;
  createdAt: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const COLUMNS = "id, slug, destination, expires_at, created_at";

type Row = {
  id: string;
  slug: string;
  destination: string;
  expires_at: string | null;
  created_at: string;
};

function project(r: Row): EvergreenTrip {
  return {
    id: r.id,
    slug: r.slug,
    destination: r.destination,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

/** Accepts a trip id, a slug, or a pasted `/t/<slug>` URL. */
export function normalizeTripRef(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/\/t\/([^/?#\s]+)/i);
  return (fromUrl?.[1] ?? trimmed).replace(/^\/+|\/+$/g, "").toLowerCase();
}

export async function setTripEvergreen(
  ref: string,
  evergreen: boolean,
): Promise<EvergreenTrip | null> {
  const key = normalizeTripRef(ref);
  if (!key) return null;
  const db = await admin();
  const expiresAt = evergreen ? null : new Date(Date.now() + WINDOW_MS).toISOString();
  const q = db.from("trips").update({ expires_at: expiresAt }).select(COLUMNS);
  const { data, error } = await (UUID_RE.test(key) ? q.eq("id", key) : q.eq("slug", key)).maybeSingle();
  if (error || !data) return null;
  return project(data as Row);
}

export async function listEvergreenTrips(): Promise<EvergreenTrip[]> {
  const db = await admin();
  const { data, error } = await db
    .from("trips")
    .select(COLUMNS)
    .is("expires_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as Row[]).map(project);
}
