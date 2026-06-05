import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side persistence for trip-generator briefs the user wants to
 * keep and reload. Local-first on the client; this layer adds cross-
 * device sync for signed-in users.
 */

const PayloadSchema = z.object({
  prompt: z.string().max(4000).optional().default(""),
  destination: z.string().max(200).optional().default(""),
  duration: z.string().max(80).optional().default(""),
  startDate: z.string().max(40).optional().default(""),
  travelers: z.string().max(80).optional().default(""),
  pace: z.enum(["", "relaxed", "balanced", "packed"]).optional().default(""),
  budget: z.enum(["", "shoestring", "moderate", "elevated", "luxury"]).optional().default(""),
  interests: z.array(z.string().max(40)).max(20).optional().default([]),
  useLiveResearch: z.boolean().optional().default(false),
});

export type SavedTripRequestPayload = z.infer<typeof PayloadSchema>;

export const listSavedTripRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("saved_trip_requests")
      .select("id, label, payload, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { saved: data ?? [] };
  });

export const upsertSavedTripRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        label: z.string().min(1).max(160),
        payload: PayloadSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("saved_trip_requests")
        .update({ label: data.label, payload: data.payload })
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("id, label, payload, updated_at")
        .single();
      if (error) throw new Error(error.message);
      return { saved: row };
    }
    const { data: row, error } = await supabase
      .from("saved_trip_requests")
      .insert({ user_id: userId, label: data.label, payload: data.payload })
      .select("id, label, payload, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { saved: row };
  });

export const deleteSavedTripRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("saved_trip_requests")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });