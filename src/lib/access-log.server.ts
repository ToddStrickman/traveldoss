/**
 * Access audit trail writer. Every view/export of a dossier lands here,
 * server-side only — the client never inserts audit rows, so the ledger
 * cannot be forged or suppressed from the browser.
 *
 * Privacy: no raw IPs are stored. The visitor fingerprint is a truncated
 * SHA-256 of ip + user-agent + trip slug, which is enough to distinguish
 * "three different people" from "one person reloading" without identifying
 * anyone. User agents are truncated to 200 chars.
 */
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TripAccessEventType = "view" | "export_pdf" | "export_ics" | "export_gdoc";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientIp(headers: Headers | undefined): string {
  return (
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Resolves the caller from the bearer token, when one is present. */
export async function resolveOptionalActor(): Promise<string | null> {
  const auth = getRequest()?.headers?.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;
  try {
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Appends one audit row. Never throws: an audit write must not break the
 * page it is recording (failures are logged for the server operator).
 */
export async function recordTripAccess(input: {
  tripId: string;
  tripSlug: string;
  eventType: TripAccessEventType;
  actorUserId?: string | null;
  ownerUserId?: string | null;
}): Promise<void> {
  try {
    const headers = getRequest()?.headers;
    const ua = headers?.get("user-agent")?.slice(0, 200) ?? null;
    const visitorHash = (
      await sha256Hex(`${clientIp(headers)}|${ua ?? ""}|${input.tripSlug}`)
    ).slice(0, 32);
    const actorUserId = input.actorUserId ?? null;
    const { error } = await supabaseAdmin.from("trip_access_events").insert({
      trip_id: input.tripId,
      trip_slug: input.tripSlug,
      actor_user_id: actorUserId,
      is_owner: !!actorUserId && !!input.ownerUserId && actorUserId === input.ownerUserId,
      event_type: input.eventType,
      visitor_hash: visitorHash,
      user_agent: ua,
    });
    if (error) console.error("[access-log] insert failed", error);
  } catch (err) {
    console.error("[access-log] record failed", err);
  }
}
