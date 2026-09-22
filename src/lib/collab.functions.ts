/**
 * Shared editing (Directive 08, Phase 2): creator invites, the members panel,
 * owner history with restore and roll back, and invite acceptance.
 *
 * Ownership rules are enforced here on the server (R4) and again in the
 * database (the `trips_guard_owner_fields` trigger and the member policies).
 * Content writes run through the caller's own session so the change-log
 * trigger attributes them to a real person (R2).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INVITE_EXPIRY_DAYS, inviteUrl } from "@/lib/collab/roles";
import { hashInviteToken, newInviteToken, normalizeEmail } from "@/lib/collab/token.server";
import { sendInviteEmail } from "@/lib/collab/invite-email.server";
import { SITE_URL } from "@/lib/site";
import type { Block } from "@/lib/skins/types";

type TripRow = { id: string; user_id: string; destination: string; slug: string; content: unknown };

async function loadTripAsOwner(tripId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("trips")
    .select("id, user_id, destination, slug, content")
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const trip = data as TripRow | null;
  if (!trip) throw new Error("Trip not found");
  if (trip.user_id !== userId) throw new Error("Only the trip creator can do this");
  return trip;
}

function blocksOf(content: unknown): Block[] {
  const blocks = (content as { blocks?: unknown } | null)?.blocks;
  return Array.isArray(blocks) ? (blocks as Block[]) : [];
}

/** Short human label for a block, for history previews. No addresses, no notes. */
function blockLabel(b: Block): string {
  if (!b || typeof b !== "object") return "Item";
  if (b.kind === "place") return b.name?.trim() || "Stop";
  if (b.kind === "flight") return [b.airline, b.flightNumber].filter(Boolean).join(" ") || "Flight";
  if (b.kind === "day") return b.label?.trim() || `Day ${b.n ?? ""}`.trim();
  if (b.kind === "section") return b.title?.trim() || "Section";
  if (b.kind === "hero") return b.title?.trim() || "Cover";
  return b.kind;
}

/** Display names for a set of user ids, from profiles (attribution source). */
async function displayNames(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { user_id: string; display_name: string | null };
    if (r.display_name) out[r.user_id] = r.display_name;
  }
  return out;
}

/** The roster for a trip. The creator also sees pending invites. */
export const getTripTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // RLS decides visibility: owner or active member, nothing else.
    const { data: visible } = await supabase
      .from("trips")
      .select("id, user_id, destination")
      .eq("id", data.tripId)
      .maybeSingle();
    if (!visible) throw new Error("Trip not found or unavailable to this account.");
    const isOwner = (visible as { user_id: string }).user_id === userId;

    const { data: rows, error } = await supabaseAdmin
      .from("trip_members")
      .select("id, user_id, email, role, status, source, joined_at, created_at")
      .eq("trip_id", data.tripId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as Array<{
      id: string;
      user_id: string | null;
      email: string;
      role: string;
      status: string;
      source: string;
      joined_at: string | null;
      created_at: string;
    }>;
    const names = await displayNames(all.map((m) => m.user_id ?? ""));
    const members = (isOwner ? all : all.filter((m) => m.status === "active")).map((m) => ({
      id: m.id,
      // Members see who is on the trip, not everyone's address.
      email: isOwner ? m.email : null,
      name: (m.user_id && names[m.user_id]) || null,
      role: m.role,
      status: m.status,
      source: m.source,
      joinedAt: m.joined_at,
      createdAt: m.created_at,
    }));

    let invites: Array<{ id: string; email: string; expiresAt: string; createdAt: string }> = [];
    if (isOwner) {
      const { data: inv } = await supabaseAdmin
        .from("trip_invites")
        .select("id, email, expires_at, created_at")
        .eq("trip_id", data.tripId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      invites = ((inv ?? []) as Array<{ id: string; email: string; expires_at: string; created_at: string }>).map(
        (i) => ({ id: i.id, email: i.email, expiresAt: i.expires_at, createdAt: i.created_at }),
      );
    }
    return { isOwner, members, invites };
  });

/**
 * Creator invites. One row per address, one single-use token each. The email
 * goes out from TravelDoss with the creator's name as sender and their address
 * as reply-to; when sending is not configured the link is returned instead.
 */
export const inviteToTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tripId: z.string().uuid(),
        emails: z.array(z.string().email()).min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const trip = await loadTripAsOwner(data.tripId, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inviterEmail = (claims as { email?: string }).email ?? "";
    const names = await displayNames([userId]);
    const inviterName = names[userId] || inviterEmail.split("@")[0] || "A traveller";
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000).toISOString();

    const results: Array<{ email: string; link: string; emailed: boolean; reason?: string }> = [];
    for (const raw of data.emails) {
      const email = normalizeEmail(raw);
      if (email === normalizeEmail(inviterEmail)) continue;
      const token = newInviteToken();
      const tokenHash = await hashInviteToken(token);
      await supabaseAdmin
        .from("trip_members")
        .upsert(
          {
            trip_id: data.tripId,
            email,
            role: "editor",
            status: "invited",
            source: "creator_invite",
            invited_by: userId,
          },
          { onConflict: "trip_id,email" },
        );
      const { error: invErr } = await supabaseAdmin.from("trip_invites").insert({
        trip_id: data.tripId,
        email,
        token_hash: tokenHash,
        invited_by: userId,
        expires_at: expiresAt,
      });
      if (invErr) throw new Error(invErr.message);
      const link = inviteUrl(SITE_URL, token);
      const mail = await sendInviteEmail({
        to: email,
        inviterName,
        inviterEmail,
        tripTitle: trip.destination,
        link,
      });
      results.push({ email, link, emailed: mail.sent, reason: mail.reason });
    }
    return { invited: results, expiresAt };
  });

export const revokeTripInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid(), inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await loadTripAsOwner(data.tripId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trip_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("trip_id", data.tripId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTripMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid(), memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await loadTripAsOwner(data.tripId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trip_members")
      .update({ status: "removed" })
      .eq("id", data.memberId)
      .eq("trip_id", data.tripId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner-only history: who changed what, and what a restore would bring back. */
export const getTripHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await loadTripAsOwner(data.tripId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("trip_changes")
      .select("id, actor_id, actor_kind, action, before, after, added_count, removed_count, created_at")
      .eq("trip_id", data.tripId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 60);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string;
      actor_id: string | null;
      actor_kind: string;
      action: string;
      before: unknown;
      after: unknown;
      added_count: number;
      removed_count: number;
      created_at: string;
    }>;
    const names = await displayNames(list.map((r) => r.actor_id ?? ""));
    return {
      changes: list.map((r) => {
        const before = blocksOf(r.before);
        const after = blocksOf(r.after);
        const afterLabels = new Set(after.map(blockLabel));
        const deleted = before
          .map((b, index) => ({ index, label: blockLabel(b) }))
          .filter((d) => !afterLabels.has(d.label))
          .slice(0, 8);
        return {
          id: r.id,
          actorName: r.actor_id ? names[r.actor_id] || "A co-planner" : "TravelDoss",
          actorKind: r.actor_kind,
          isOwnerActor: r.actor_id === context.userId,
          action: r.action,
          addedCount: r.added_count,
          removedCount: r.removed_count,
          createdAt: r.created_at,
          deleted,
        };
      }),
    };
  });

/** Roll the whole trip back to the state just before a change. */
export const rollbackTripTo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid(), changeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await loadTripAsOwner(data.tripId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: change, error } = await supabaseAdmin
      .from("trip_changes")
      .select("id, before")
      .eq("id", data.changeId)
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!change) throw new Error("That history entry is no longer available.");
    const content = (change as { before: unknown }).before;
    if (!content) throw new Error("Nothing to roll back to.");
    // Written through the caller's own session so the change log attributes
    // the rollback to them — which is what makes a rollback undoable.
    const { data: updated, error: upErr } = await context.supabase
      .from("trips")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ content: content as any })
      .eq("id", data.tripId)
      .select("id");
    if (upErr) throw new Error(upErr.message);
    if (!updated?.length) throw new Error("Roll back rejected — this account can't edit this trip.");
    return { ok: true };
  });

/** Bring one deleted block back to its original position. */
export const restoreDeletedBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tripId: z.string().uuid(), changeId: z.string().uuid(), index: z.number().int().min(0).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const trip = await loadTripAsOwner(data.tripId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: change } = await supabaseAdmin
      .from("trip_changes")
      .select("before")
      .eq("id", data.changeId)
      .eq("trip_id", data.tripId)
      .maybeSingle();
    const before = blocksOf((change as { before: unknown } | null)?.before);
    const block = before[data.index];
    if (!block) throw new Error("That item is no longer in the history.");
    const current = (trip.content ?? {}) as Record<string, unknown>;
    const blocks = blocksOf(trip.content).slice();
    blocks.splice(Math.min(data.index, blocks.length), 0, block);
    const { data: updated, error } = await context.supabase
      .from("trips")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ content: { ...current, blocks } as any })
      .eq("id", data.tripId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("Restore rejected — this account can't edit this trip.");
    return { ok: true, label: blockLabel(block) };
  });

/** Public preview for the accept page — trip name and inviter only. */
export const getInvitePreview = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ token: z.string().min(10).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await hashInviteToken(data.token);
    const { data: invite } = await supabaseAdmin
      .from("trip_invites")
      .select("id, trip_id, email, invited_by, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    const row = invite as {
      id: string;
      trip_id: string;
      email: string;
      invited_by: string;
      expires_at: string;
      accepted_at: string | null;
      revoked_at: string | null;
    } | null;
    if (!row) return { state: "invalid" as const };
    if (row.revoked_at) return { state: "revoked" as const };
    if (row.accepted_at) return { state: "used" as const };
    if (new Date(row.expires_at).getTime() < Date.now()) return { state: "expired" as const };
    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("destination, hero_image_url, slug")
      .eq("id", row.trip_id)
      .maybeSingle();
    const names = await displayNames([row.invited_by]);
    return {
      state: "ready" as const,
      email: row.email,
      tripTitle: (trip as { destination?: string } | null)?.destination ?? "a trip",
      heroImageUrl: (trip as { hero_image_url?: string | null } | null)?.hero_image_url ?? null,
      inviterName: names[row.invited_by] || "A traveller",
    };
  });

/** Accept: signed in as the invited address, single use. */
export const acceptTripInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(10).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = normalizeEmail((claims as { email?: string }).email ?? "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = await hashInviteToken(data.token);
    const { data: invite } = await supabaseAdmin
      .from("trip_invites")
      .select("id, trip_id, email, expires_at, accepted_at, revoked_at, created_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    const row = invite as {
      id: string;
      trip_id: string;
      email: string;
      expires_at: string;
      accepted_at: string | null;
      revoked_at: string | null;
      created_at: string;
    } | null;
    if (!row) throw new Error("This invitation link isn't valid.");
    if (row.revoked_at) throw new Error("This invitation was withdrawn.");
    if (row.accepted_at) throw new Error("This invitation has already been used.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("This invitation has expired.");
    if (normalizeEmail(row.email) !== email) {
      throw new Error(`This invitation was sent to ${row.email}. Sign in with that address to accept it.`);
    }
    const now = new Date().toISOString();
    const { error: memberErr } = await supabaseAdmin
      .from("trip_members")
      .upsert(
        {
          trip_id: row.trip_id,
          email: normalizeEmail(row.email),
          user_id: userId,
          role: "editor",
          status: "active",
          source: "creator_invite",
          joined_at: now,
        },
        { onConflict: "trip_id,email" },
      );
    if (memberErr) throw new Error(memberErr.message);
    const { error: inviteErr } = await supabaseAdmin
      .from("trip_invites")
      .update({ accepted_at: now })
      .eq("id", row.id)
      .is("accepted_at", null);
    if (inviteErr) throw new Error(inviteErr.message);
    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("slug")
      .eq("id", row.trip_id)
      .maybeSingle();
    const days = Math.max(
      0,
      Math.round((Date.now() - new Date(row.created_at).getTime()) / 86_400_000),
    );
    return { ok: true, slug: (trip as { slug?: string } | null)?.slug ?? null, daysToAccept: days };
  });
