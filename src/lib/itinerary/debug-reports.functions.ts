import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DebugReport } from "@/lib/itinerary/debug-report";

/** Persist a debug report for the authenticated user. */
export const saveDebugReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid().nullable().optional(),
        report: z.any(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const report = data.report as DebugReport;
    if (!report || typeof report !== "object") {
      throw new Error("Invalid report payload.");
    }
    const { data: row, error } = await supabase
      .from("parse_debug_reports")
      .insert({
        user_id: userId,
        trip_id: data.tripId ?? null,
        source: String(report.source ?? "unknown").slice(0, 32),
        outcome: String(report.outcome ?? "unknown").slice(0, 32),
        attempts_count: Array.isArray(report.attempts) ? report.attempts.length : 0,
        report: report as unknown as Record<string, unknown>,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, createdAt: row.created_at as string };
  });

/** List the authenticated user's recent debug reports, optionally scoped to a trip. */
export const listDebugReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("parse_debug_reports")
      .select("id, trip_id, source, outcome, attempts_count, created_at, report")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (data.tripId) query = query.eq("trip_id", data.tripId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { reports: rows ?? [] };
  });

/** Delete one of the user's debug reports. */
export const deleteDebugReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("parse_debug_reports")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });