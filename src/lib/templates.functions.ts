import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTemplate } from "@/lib/templates";

function randomSuffix(len = 6) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const listTemplatesPublic = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: true };
});

export const pickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ templateId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const template = getTemplate(data.templateId);
    if (!template) throw new Error("Unknown template");

    const slug = `${template.id}-${randomSuffix()}`;

    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        destination: template.title,
        subtitle: template.subtitle,
        tone: template.tone,
        template_id: template.id,
        slug,
        visibility: "unlisted",
        status: "draft",
        content: { blocks: template.doc, accent: template.accent, crawl: template.crawl, days: template.days },
      })
      .select("id, slug")
      .single();
    if (error) {
      console.error("[pickTemplate] trip insert failed", error);
      throw new Error("Failed to create dossier");
    }

    return { tripId: trip.id, slug: trip.slug };
  });

export const getDossierBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: trip, error } = await supabaseAdmin
      .from("trips")
      .select(
        "id, slug, destination, subtitle, tone, template_id, hero_image_url, start_date, end_date, content, visibility, status",
      )
      .eq("slug", data.slug)
      .neq("visibility", "private")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trip) return { trip: null as const };
    return { trip };
  });