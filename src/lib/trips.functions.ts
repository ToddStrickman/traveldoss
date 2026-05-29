import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("trips")
      .select("id, destination, start_date, end_date, doc_url, status, hero_image_url, last_synced_at:updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { trips: data ?? [] };
  });

export const getDriveConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("google_tokens")
      .select("google_email, expires_at, scope")
      .eq("user_id", userId)
      .maybeSingle();
    return { connected: !!data, email: data?.google_email ?? null };
  });