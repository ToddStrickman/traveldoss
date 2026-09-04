/**
 * Investor snapshots: a frozen, read-only copy of the console's aggregate
 * panels, served at /admin/s/:token to someone with no account.
 *
 * Design constraints that make this safe to hand to a stranger:
 *   - the token is the credential, so it is 32 random hex chars and never
 *     derived from anything guessable (id, email, date);
 *   - the payload is frozen at creation time — the link cannot become a live
 *     window into the product later;
 *   - the frozen payload is the same aggregate shape the console renders, so no
 *     live feed, no session ids, no slugs, no emails;
 *   - links expire (30 days by default) and can be revoked instantly.
 *
 * Server-only: writes and reads run with the service role.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadAdminMetrics, type AdminMetrics } from "@/lib/admin/queries.server";

export interface SnapshotRow {
  id: string;
  token: string;
  label: string | null;
  rangeDays: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

export interface PublicSnapshot {
  label: string | null;
  rangeDays: number;
  /** "As of" stamp shown on every card, so nobody mistakes this for live data. */
  createdAt: string;
  expiresAt: string;
  metrics: AdminMetrics;
}

const DAY_MS = 86_400_000;

function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSnapshot(
  userId: string,
  days: number,
  label: string | null,
  ttlDays: number,
): Promise<SnapshotRow> {
  const metrics = await loadAdminMetrics(days);
  const token = newToken();
  const expiresAt = new Date(Date.now() + ttlDays * DAY_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from("admin_snapshots")
    .insert({
      token,
      label,
      created_by: userId,
      range_days: days,
      payload: { metrics, capturedAt: new Date().toISOString() } as unknown as Record<string, unknown>,
      expires_at: expiresAt,
    })
    .select("id, token, label, range_days, created_at, expires_at, revoked_at, view_count, last_viewed_at")
    .single();
  if (error || !data) throw new Error("Snapshot could not be created");
  return mapRow(data);
}

export async function listSnapshots(): Promise<SnapshotRow[]> {
  const { data } = await supabaseAdmin
    .from("admin_snapshots")
    .select("id, token, label, range_days, created_at, expires_at, revoked_at, view_count, last_viewed_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(mapRow);
}

export async function revokeSnapshot(id: string): Promise<void> {
  await supabaseAdmin
    .from("admin_snapshots")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
}

/** Public read. Returns null for unknown, revoked, or expired tokens alike —
 *  a wrong token must not reveal whether it ever existed. */
export async function readSnapshot(token: string): Promise<PublicSnapshot | null> {
  const { data } = await supabaseAdmin
    .from("admin_snapshots")
    .select("id, label, range_days, payload, created_at, expires_at, revoked_at, view_count")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  const payload = data.payload as { metrics?: AdminMetrics; capturedAt?: string } | null;
  if (!payload?.metrics) return null;

  await supabaseAdmin
    .from("admin_snapshots")
    .update({ view_count: (data.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    label: data.label,
    rangeDays: data.range_days,
    createdAt: payload.capturedAt ?? data.created_at,
    expiresAt: data.expires_at,
    metrics: payload.metrics,
  };
}

function mapRow(r: {
  id: string;
  token: string;
  label: string | null;
  range_days: number;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}): SnapshotRow {
  return {
    id: r.id,
    token: r.token,
    label: r.label,
    rangeDays: r.range_days,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    viewCount: r.view_count,
    lastViewedAt: r.last_viewed_at,
  };
}
