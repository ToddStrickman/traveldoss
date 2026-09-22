import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  emptyDossier,
  defaultPreferences,
  type TravelDossier,
  type EmailAccountConnection,
} from "./types";
import { stable } from "./normalize";

/**
 * Private adaptive state is written only by this server-only module, through the
 * project's generated service-role client. The adaptive tables and routines are
 * not in the generated types, so the client is used untyped here; every call
 * site below is owner-scoped explicitly.
 */
export function adaptiveDb(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}
export function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Adaptive storage: ${result.error.message}`);
  return result.data;
}
export async function ownerTrips(userId: string) {
  return (
    checked(
      await adaptiveDb()
        .from("trips")
        .select("id,slug,destination,start_date,end_date,content")
        .eq("user_id", userId),
    ) ?? []
  );
}
export async function requireTrip(userId: string, tripId: string) {
  const trip = checked(
    await adaptiveDb()
      .from("trips")
      .select("id,slug,destination,start_date,end_date")
      .eq("user_id", userId)
      .eq("id", tripId)
      .maybeSingle(),
  );
  if (!trip) throw new Error("Trip not found or unavailable to this account.");
  return trip;
}
export async function readState(
  userId: string,
): Promise<{ state: TravelDossier; revision: number }> {
  const row = checked(
    await adaptiveDb()
      .from("adaptive_workspaces")
      .select("state,revision")
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (row) return { state: row.state, revision: row.revision };
  const state = emptyDossier();
  checked(
    await adaptiveDb()
      .from("adaptive_workspaces")
      .upsert({ user_id: userId, state }, { onConflict: "user_id", ignoreDuplicates: true }),
  );
  const created = checked(
    await adaptiveDb()
      .from("adaptive_workspaces")
      .select("state,revision")
      .eq("user_id", userId)
      .single(),
  );
  if (!created) throw new Error("Could not initialize adaptive storage.");
  return { state: created.state, revision: created.revision };
}
/** Pure mutations can safely be retried. A failed save never acknowledges an email cursor. */
export async function mutateState(
  userId: string,
  mutation: (state: TravelDossier) => TravelDossier,
): Promise<TravelDossier> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, revision } = await readState(userId);
    const next = mutation(structuredClone(state));
    const payload = stable(next);
    if (payload === stable(state)) return state;
    if (new TextEncoder().encode(payload).length > 11_000_000)
      throw new Error(
        "Your dossier history has reached the current storage limit. Sync paused safely; no history was removed.",
      );
    const result = checked(
      await adaptiveDb().rpc("adaptive_compare_and_swap", {
        p_user_id: userId,
        p_revision: revision,
        p_state: next,
      }),
    );
    if (result !== null) return next;
  }
  throw new Error("Another update is still saving. Please retry; your changes were not discarded.");
}
export async function refreshTrips(userId: string): Promise<TravelDossier> {
  const trips = await ownerTrips(userId);
  return mutateState(userId, (state) => {
    for (const row of trips ?? []) {
      const trip = state.trips.find((t) => t.id === row.id);
      const fields = {
        id: row.id,
        slug: row.slug,
        destination: row.destination,
        startDate: row.start_date ?? undefined,
        endDate: row.end_date ?? undefined,
      };
      if (trip) Object.assign(trip, fields);
      else
        state.trips.push({
          ...fields,
          preferences: defaultPreferences(),
          session: { phase: "planning" },
        });
    }
    return state;
  });
}
export async function accounts(userId: string): Promise<EmailAccountConnection[]> {
  return (
    checked(
      await adaptiveDb()
        .from("adaptive_email_accounts")
        .select("id,provider,email,status,sync")
        .eq("user_id", userId),
    ) ?? []
  );
}
