/**
 * Sharing: the traveler's one decision about whether confirmed reservations
 * appear on their shared dossier page. Everything private (email evidence,
 * confirmation numbers, live status) stays in the workspace either way.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Block } from "@/lib/skins/types";
import { mergeConfirmedIntoBlocks } from "./share";
import { mutateState, ownerTrips, readState } from "./store.server";
import { recordChange } from "./reconcile";

const tripInput = z.object({ tripId: z.string().uuid() });

type TripContent = { blocks?: Block[]; skin?: string } & Record<string, unknown>;

/** Writes merged blocks back to the shared dossier as the signed-in owner (RLS applies). */
async function writeBlocks(
  supabase: SupabaseClient,
  tripId: string,
  content: TripContent,
  blocks: Block[],
) {
  const { error } = await supabase
    .from("trips")
    .update({ content: { ...content, blocks } })
    .eq("id", tripId);
  if (error) throw new Error(error.message);
}

/**
 * Copy every confirmed reservation for this trip onto the shared dossier page.
 * `mode: "always"` also remembers the choice so later syncs keep it current;
 * `mode: "once"` copies what exists today and changes nothing else.
 */
export const shareConfirmedToDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.extend({ mode: z.enum(["once", "always"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const trip = (await ownerTrips(context.userId)).find((t) => t.id === data.tripId);
    if (!trip) throw new Error("Trip not found or unavailable to this account.");
    const content = (trip.content ?? {}) as TripContent;
    const before = (content.blocks ?? []) as Block[];
    const { state } = await readState(context.userId);
    const merged = mergeConfirmedIntoBlocks(before, state.items, data.tripId);
    if (merged.added || merged.updated)
      await writeBlocks(context.supabase as unknown as SupabaseClient, data.tripId, content, merged.blocks);
    const now = new Date().toISOString();
    await mutateState(context.userId, (s) => {
      const t = s.trips.find((x) => x.id === data.tripId);
      if (t) t.preferences = { ...t.preferences, sharing: data.mode === "always" ? "auto" : "off" };
      // One undo snapshot per trip — the shared page before this share ran.
      s.shares = [
        ...(s.shares ?? []).filter((x) => x.tripId !== data.tripId),
        { tripId: data.tripId, at: now, previousBlocks: before },
      ];
      recordChange(s, {
        id: `share:${data.tripId}:${now}`,
        tripId: data.tripId,
        at: now,
        kind: "preferences",
        actor: "user",
        summary: `${merged.added} added and ${merged.updated} updated on the shared dossier`,
        rationale:
          data.mode === "always"
            ? "The traveler chose to keep the shared dossier updated from confirmed reservations."
            : "The traveler copied confirmed reservations to the shared dossier once.",
      });
      return s;
    });
    return { added: merged.added, updated: merged.updated };
  });

/** Records "keep this private" without copying anything. */
export const setSharingPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.extend({ sharing: z.enum(["ask", "auto", "off"]) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!(await ownerTrips(context.userId)).some((t) => t.id === data.tripId))
      throw new Error("Trip not found or unavailable to this account.");
    return mutateState(context.userId, (s) => {
      const trip = s.trips.find((t) => t.id === data.tripId);
      if (trip) trip.preferences = { ...trip.preferences, sharing: data.sharing };
      return s;
    });
  });

/** Puts the shared dossier back exactly as it was before the last share. */
export const undoLastShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tripInput.parse(i))
  .handler(async ({ data, context }) => {
    const trip = (await ownerTrips(context.userId)).find((t) => t.id === data.tripId);
    if (!trip) throw new Error("Trip not found or unavailable to this account.");
    const { state } = await readState(context.userId);
    const snapshot = (state.shares ?? []).find((s) => s.tripId === data.tripId);
    if (!snapshot) throw new Error("There is nothing to undo for this trip.");
    const content = (trip.content ?? {}) as TripContent;
    await writeBlocks(
      context.supabase as unknown as SupabaseClient,
      data.tripId,
      content,
      snapshot.previousBlocks,
    );
    const now = new Date().toISOString();
    await mutateState(context.userId, (s) => {
      s.shares = (s.shares ?? []).filter((x) => x.tripId !== data.tripId);
      const t = s.trips.find((x) => x.id === data.tripId);
      if (t) t.preferences = { ...t.preferences, sharing: "off" };
      recordChange(s, {
        id: `share-undo:${data.tripId}:${now}`,
        tripId: data.tripId,
        at: now,
        kind: "restored",
        actor: "user",
        summary: "Shared dossier restored to its state before sharing",
        rationale: "The traveler undid the copy. Private reservations are unchanged.",
      });
      return s;
    });
    return { ok: true };
  });

/**
 * Called after a sync: keeps the shared page current for trips where the
 * traveler chose "always", and does nothing otherwise.
 */
export async function autoShareIfEnabled(
  userId: string,
  supabase: SupabaseClient,
  tripId: string,
): Promise<void> {
  const { state } = await readState(userId);
  const trip = state.trips.find((t) => t.id === tripId);
  if (trip?.preferences.sharing !== "auto") return;
  const row = (await ownerTrips(userId)).find((t) => t.id === tripId);
  if (!row) return;
  const content = (row.content ?? {}) as TripContent;
  const before = (content.blocks ?? []) as Block[];
  const merged = mergeConfirmedIntoBlocks(before, state.items, tripId);
  if (!merged.added && !merged.updated) return;
  await writeBlocks(supabase, tripId, content, merged.blocks);
}
